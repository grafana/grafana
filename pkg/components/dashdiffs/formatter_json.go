package dashdiffs

import (
	"bytes"
	"errors"
	"fmt"
	"html/template"
	"sort"

	diff "github.com/yudai/gojsondiff"
)

type ChangeType int

const (
	ChangeNil ChangeType = iota
	ChangeAdded
	ChangeDeleted
	ChangeOld
	ChangeNew
	ChangeUnchanged
)

var (
	// changeTypeToSymbol is used for populating the terminating character in
	// the diff
	changeTypeToSymbol = map[ChangeType]string{
		ChangeNil:     "",
		ChangeAdded:   "+",
		ChangeDeleted: "-",
		ChangeOld:     "-",
		ChangeNew:     "+",
	}

	// changeTypeToName is used for populating class names in the diff
	changeTypeToName = map[ChangeType]string{
		ChangeNil:     "same",
		ChangeAdded:   "added",
		ChangeDeleted: "deleted",
		ChangeOld:     "old",
		ChangeNew:     "new",
	}
)

var (
	// tplJSONDiffWrapper is the template that wraps a diff
	tplJSONDiffWrapper = `{{ define "JSONDiffWrapper" -}}
	{{ range $index, $element := . }}
		{{ template "JSONDiffLine" $element }}
	{{ end }}
{{ end }}`

	// tplJSONDiffLine is the template that prints each line in a diff
	tplJSONDiffLine = `{{ define "JSONDiffLine" -}}
<p id="l{{ .LineNum }}" class="diff-line diff-json-{{ cton .Change }}">
	<span class="diff-line-number">
		{{if .LeftLine }}{{ .LeftLine }}{{ end }}
	</span>
	<span class="diff-line-number">
		{{if .RightLine }}{{ .RightLine }}{{ end }}
	</span>
	<span class="diff-value diff-indent-{{ .Indent }}" title="{{ .Text }}" ng-non-bindable>
		{{ .Text }}
	</span>
	<span class="diff-line-icon">{{ ctos .Change }}</span>
</p>
{{ end }}`
)

var diffTplFuncs = template.FuncMap{
	"ctos": func(c ChangeType) string {
		if symbol, ok := changeTypeToSymbol[c]; ok {
			return symbol
		}
		return ""
	},
	"cton": func(c ChangeType) string {
		if name, ok := changeTypeToName[c]; ok {
			return name
		}
		return ""
	},
}

// JSONLine contains the data required to render each line of the JSON diff
// and contains the data required to produce the tokens output in the basic
// diff.
type JSONLine struct {
	LineNum   int        `json:"line"`
	LeftLine  int        `json:"leftLine"`
	RightLine int        `json:"rightLine"`
	Indent    int        `json:"indent"`
	Text      string     `json:"text"`
	Change    ChangeType `json:"changeType"`
	Key       string     `json:"key"`
	Val       any        `json:"value"`
}

func NewJSONFormatter(left any) *JSONFormatter {
	tpl := template.Must(template.New("JSONDiffWrapper").Funcs(diffTplFuncs).Parse(tplJSONDiffWrapper))
	tpl = template.Must(tpl.New("JSONDiffLine").Funcs(diffTplFuncs).Parse(tplJSONDiffLine))

	return &JSONFormatter{
		left:      left,
		Lines:     []*JSONLine{},
		tpl:       tpl,
		path:      []string{},
		size:      []int{},
		lineCount: 0,
		inArray:   []bool{},
	}
}

type JSONFormatter struct {
	left      any
	path      []string
	size      []int
	inArray   []bool
	lineCount int
	leftLine  int
	rightLine int
	line      *AsciiLine
	Lines     []*JSONLine
	tpl       *template.Template
}

type AsciiLine struct {
	// the type of change
	change ChangeType

	// the actual changes - no formatting
	key string
	val any

	// level of indentation for the current line
	indent int

	// buffer containing the fully formatted line
	buffer *bytes.Buffer
}

func (f *JSONFormatter) Format(diff diff.Diff) (result string, err error) {
	if v, ok := f.left.(map[string]any); ok {
		if err := f.formatObject(v, diff); err != nil {
			return "", err
		}
	} else if v, ok := f.left.([]any); ok {
		if err := f.formatArray(v, diff); err != nil {
			return "", err
		}
	} else {
		return "", fmt.Errorf("expected map[string]any or []any, got %T",
			f.left)
	}

	b := &bytes.Buffer{}
	err = f.tpl.ExecuteTemplate(b, "JSONDiffWrapper", f.Lines)
	if err != nil {
		fmt.Printf("%v\n", err)
		return "", err
	}

	return b.String(), nil
}

func (f *JSONFormatter) formatObject(left map[string]any, df diff.Diff) error {
	f.addLineWith(ChangeNil, "{")
	f.push("ROOT", len(left), false)
	if err := f.processObject(left, df.Deltas()); err != nil {
		f.pop()
		return err
	}

	f.pop()
	f.addLineWith(ChangeNil, "}")
	return nil
}

func (f *JSONFormatter) formatArray(left []any, df diff.Diff) error {
	f.addLineWith(ChangeNil, "[")
	f.push("ROOT", len(left), true)
	if err := f.processArray(left, df.Deltas()); err != nil {
		f.pop()
		return err
	}

	f.pop()
	f.addLineWith(ChangeNil, "]")
	return nil
}

func (f *JSONFormatter) processArray(array []any, deltas []diff.Delta) error {
	patchedIndex := 0
	for index, value := range array {
		if err := f.processItem(value, deltas, diff.Index(index)); err != nil {
			return err
		}

		patchedIndex++
	}

	// additional Added
	for _, delta := range deltas {
		d, ok := delta.(*diff.Added)
		if ok {
			// skip items already processed
			if int(d.Position.(diff.Index)) < len(array) {
				continue
			}
			f.printRecursive(d.String(), d.Value, ChangeAdded)
		}
	}

	return nil
}

func (f *JSONFormatter) processObject(object map[string]any, deltas []diff.Delta) error {
	names := sortKeys(object)
	for _, name := range names {
		value := object[name]
		if err := f.processItem(value, deltas, diff.Name(name)); err != nil {
			return err
		}
	}

	// Added
	for _, delta := range deltas {
		d, ok := delta.(*diff.Added)
		if ok {
			f.printRecursive(d.String(), d.Value, ChangeAdded)
		}
	}

	return nil
}

func (f *JSONFormatter) processItem(value any, deltas []diff.Delta, position diff.Position) error {
	matchedDeltas := f.searchDeltas(deltas, position)
	positionStr := position.String()
	if len(matchedDeltas) > 0 {
		for _, matchedDelta := range matchedDeltas {
			switch matchedDelta := matchedDelta.(type) {
			case *diff.Object:
				switch value.(type) {
				case map[string]any:
					// ok
				default:
					return errors.New("type mismatch")
				}
				o := value.(map[string]any)

				f.newLine(ChangeNil)
				f.printKey(positionStr)
				f.print("{")
				f.closeLine()
				f.push(positionStr, len(o), false)
				if err := f.processObject(o, matchedDelta.Deltas); err != nil {
					f.pop()
					return err
				}

				f.pop()
				f.newLine(ChangeNil)
				f.print("}")
				f.printComma()
				f.closeLine()

			case *diff.Array:
				switch value.(type) {
				case []any:
					// ok
				default:
					return errors.New("type mismatch")
				}
				a := value.([]any)

				f.newLine(ChangeNil)
				f.printKey(positionStr)
				f.print("[")
				f.closeLine()
				f.push(positionStr, len(a), true)
				if err := f.processArray(a, matchedDelta.Deltas); err != nil {
					f.pop()
					return err
				}

				f.pop()
				f.newLine(ChangeNil)
				f.print("]")
				f.printComma()
				f.closeLine()

			case *diff.Added:
				f.printRecursive(positionStr, matchedDelta.Value, ChangeAdded)
				f.size[len(f.size)-1]++

			case *diff.Modified:
				savedSize := f.size[len(f.size)-1]
				f.printRecursive(positionStr, matchedDelta.OldValue, ChangeOld)
				f.size[len(f.size)-1] = savedSize
				f.printRecursive(positionStr, matchedDelta.NewValue, ChangeNew)

			case *diff.TextDiff:
				savedSize := f.size[len(f.size)-1]
				f.printRecursive(positionStr, matchedDelta.OldValue, ChangeOld)
				f.size[len(f.size)-1] = savedSize
				f.printRecursive(positionStr, matchedDelta.NewValue, ChangeNew)

			case *diff.Deleted:
				f.printRecursive(positionStr, matchedDelta.Value, ChangeDeleted)

			default:
				return fmt.Errorf("unknown Delta type detected %#v", matchedDelta)
			}
		}
	} else {
		f.printRecursive(positionStr, value, ChangeUnchanged)
	}

	return nil
}

func (f *JSONFormatter) searchDeltas(deltas []diff.Delta, position diff.Position) (results []diff.Delta) {
	results = make([]diff.Delta, 0)
	for _, delta := range deltas {
		switch typedDelta := delta.(type) {
		case diff.PostDelta:
			if typedDelta.PostPosition() == position {
				results = append(results, delta)
			}
		case diff.PreDelta:
			if typedDelta.PrePosition() == position {
				results = append(results, delta)
			}
		default:
			panic("heh")
		}
	}
	return
}

func (f *JSONFormatter) push(name string, size int, array bool) {
	f.path = append(f.path, name)
	f.size = append(f.size, size)
	f.inArray = append(f.inArray, array)
}

func (f *JSONFormatter) pop() {
	f.path = f.path[0 : len(f.path)-1]
	f.size = f.size[0 : len(f.size)-1]
	f.inArray = f.inArray[0 : len(f.inArray)-1]
}

func (f *JSONFormatter) addLineWith(change ChangeType, value string) {
	f.line = &AsciiLine{
		change: change,
		indent: len(f.path),
		buffer: bytes.NewBufferString(value),
	}
	f.closeLine()
}

func (f *JSONFormatter) newLine(change ChangeType) {
	f.line = &AsciiLine{
		change: change,
		indent: len(f.path),
		buffer: bytes.NewBuffer([]byte{}),
	}
}

func (f *JSONFormatter) closeLine() {
	leftLine := 0
	rightLine := 0
	f.lineCount++

	switch f.line.change {
	case ChangeAdded, ChangeNew:
		f.rightLine++
		rightLine = f.rightLine

	case ChangeDeleted, ChangeOld:
		f.leftLine++
		leftLine = f.leftLine

	case ChangeNil, ChangeUnchanged:
		f.rightLine++
		f.leftLine++
		rightLine = f.rightLine
		leftLine = f.leftLine
	}

	s := f.line.buffer.String()
	f.Lines = append(f.Lines, &JSONLine{
		LineNum:   f.lineCount,
		RightLine: rightLine,
		LeftLine:  leftLine,
		Indent:    f.line.indent,
		Text:      s,
		Change:    f.line.change,
		Key:       f.line.key,
		Val:       f.line.val,
	})
}

func (f *JSONFormatter) printKey(name string) {
	if !f.inArray[len(f.inArray)-1] {
		f.line.key = name
		fmt.Fprintf(f.line.buffer, `"%s": `, name)
	}
}

func (f *JSONFormatter) printComma() {
	f.size[len(f.size)-1]--
	if f.size[len(f.size)-1] > 0 {
		f.line.buffer.WriteRune(',')
	}
}

func (f *JSONFormatter) printValue(value any) {
	switch value.(type) {
	case string:
		f.line.val = value
		fmt.Fprintf(f.line.buffer, `"%s"`, value)
	case nil:
		f.line.val = "null"
		f.line.buffer.WriteString("null")
	default:
		f.line.val = value
		fmt.Fprintf(f.line.buffer, `%#v`, value)
	}
}

func (f *JSONFormatter) print(a string) {
	f.line.buffer.WriteString(a)
}

func (f *JSONFormatter) printRecursive(name string, value any, change ChangeType) {
	switch value := value.(type) {
	case map[string]any:
		f.newLine(change)
		f.printKey(name)
		f.print("{")
		f.closeLine()

		size := len(value)
		f.push(name, size, false)

		keys := sortKeys(value)
		for _, key := range keys {
			f.printRecursive(key, value[key], change)
		}
		f.pop()

		f.newLine(change)
		f.print("}")
		f.printComma()
		f.closeLine()

	case []any:
		f.newLine(change)
		f.printKey(name)
		f.print("[")
		f.closeLine()

		size := len(value)
		f.push("", size, true)
		for _, item := range value {
			f.printRecursive("", item, change)
		}
		f.pop()

		f.newLine(change)
		f.print("]")
		f.printComma()
		f.closeLine()

	default:
		f.newLine(change)
		f.printKey(name)
		f.printValue(value)
		f.printComma()
		f.closeLine()
	}
}

func sortKeys(m map[string]any) (keys []string) {
	keys = make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return
}
