package dashdiffs

import (
	"bytes"
	"html/template"

	diff "github.com/yudai/gojsondiff"
)

// A BasicDiff holds the stateful values that are used when generating a basic
// diff from JSON tokens.
type BasicDiff struct {
	narrow     string
	keysIdent  int
	writing    bool
	LastIndent int
	Block      *BasicBlock
	Change     *BasicChange
	Summary    *BasicSummary
}

// A BasicBlock represents a top-level element in a basic diff.
type BasicBlock struct {
	Title     string
	Old       interface{}
	New       interface{}
	Change    ChangeType
	Changes   []*BasicChange
	Summaries []*BasicSummary
	LineStart int
	LineEnd   int
}

// A BasicChange represents the change from an old to new value. There are many
// BasicChanges in a BasicBlock.
type BasicChange struct {
	Key       string
	Old       interface{}
	New       interface{}
	Change    ChangeType
	LineStart int
	LineEnd   int
}

// A BasicSummary represents the changes within a basic block that're too deep
// or verbose to be represented in the top-level BasicBlock element, or in the
// BasicChange. Instead of showing the values in this case, we simply print
// the key and count how many times the given change was applied to that
// element.
type BasicSummary struct {
	Key       string
	Change    ChangeType
	Count     int
	LineStart int
	LineEnd   int
}

type BasicFormatter struct {
	jsonDiff *JSONFormatter
	tpl      *template.Template
}

func NewBasicFormatter(left interface{}) *BasicFormatter {
	tpl := template.Must(template.New("block").Funcs(tplFuncMap).Parse(tplBlock))
	tpl = template.Must(tpl.New("change").Funcs(tplFuncMap).Parse(tplChange))
	tpl = template.Must(tpl.New("summary").Funcs(tplFuncMap).Parse(tplSummary))

	return &BasicFormatter{
		jsonDiff: NewJSONFormatter(left),
		tpl:      tpl,
	}
}

// Format takes the diff of two JSON documents, and returns the difference
// between them summarized in an HTML document.
func (b *BasicFormatter) Format(d diff.Diff) ([]byte, error) {
	// calling jsonDiff.Format(d) populates the JSON diff's "Lines" value,
	// which we use to compute the basic dif
	_, err := b.jsonDiff.Format(d)
	if err != nil {
		return nil, err
	}

	bd := &BasicDiff{}
	blocks := bd.Basic(b.jsonDiff.Lines)
	buf := &bytes.Buffer{}

	err = b.tpl.ExecuteTemplate(buf, "block", blocks)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// Basic transforms a slice of JSONLines into a slice of BasicBlocks.
func (b *BasicDiff) Basic(lines []*JSONLine) []*BasicBlock {
	// init an array you can append to for the basic "blocks"
	blocks := make([]*BasicBlock, 0)

	for _, line := range lines {
		if b.returnToTopLevelKey(line) {
			if b.Block != nil {
				blocks = append(blocks, b.Block)
			}
		}

		// Record the last indent level at each pass in case we need to
		// check for a change in depth inside the JSON data structures.
		b.LastIndent = line.Indent

		if line.Indent == 1 {
			if block, ok := b.handleTopLevelChange(line); ok {
				blocks = append(blocks, block)
			}
		}

		// Here is where we handle changes for all types, appending each change
		// to the current block based on the value.
		//
		// Values which only occupy a single line in JSON (like a string or
		// int, for example) are treated as "Basic Changes" that we append to
		// the current block as soon as they're detected.
		//
		// Values which occupy multiple lines (either slices or maps) are
		// treated as "Basic Summaries". When we detect the "ChangeNil" type,
		// we know we've encountered one of these types, so we record the
		// starting position as well the type of the change, and stop
		// performing comparisons until we find the end of that change. Upon
		// finding the change, we append it to the current block, and begin
		// performing comparisons again.
		if line.Indent > 1 {
			// check to ensure a single line change
			if b.isSingleLineChange(line) {
				switch line.Change {
				case ChangeAdded, ChangeDeleted:

					b.Block.Changes = append(b.Block.Changes, &BasicChange{
						Key:       line.Key,
						Change:    line.Change,
						New:       line.Val,
						LineStart: line.LineNum,
					})

				case ChangeOld:
					b.Change = &BasicChange{
						Key:       line.Key,
						Change:    line.Change,
						Old:       line.Val,
						LineStart: line.LineNum,
					}

				case ChangeNew:
					b.Change.New = line.Val
					b.Change.LineEnd = line.LineNum
					b.Block.Changes = append(b.Block.Changes, b.Change)

				default:
					//ok
				}

				// otherwise, we're dealing with a change at a deeper level. We
				// know there's a change somewhere in the JSON tree, but we
				// don't know exactly where, so we go deeper.
			} else {

				// if the change is anything but unchanged, continue processing
				//
				// we keep "narrowing" the key as we go deeper, in order to
				// correctly report the key name for changes found within an
				// object or array.
				if line.Change != ChangeUnchanged {
					if line.Key != "" {
						b.narrow = line.Key
						b.keysIdent = line.Indent
					}

					// if the change isn't nil, and we're not already writing
					// out a change, then we've found something.
					//
					// First, try to determine the title of the embedded JSON
					// object. If it's an empty string, then we're in an object
					// or array, so we default to using the "narrowed" key.
					//
					// We also start recording the basic summary, until we find
					// the next `ChangeUnchanged`.
					if line.Change != ChangeNil {
						if !b.writing {
							b.writing = true
							key := b.Block.Title

							if b.narrow != "" {
								key = b.narrow
								if b.keysIdent > line.Indent {
									key = b.Block.Title
								}
							}

							b.Summary = &BasicSummary{
								Key:       key,
								Change:    line.Change,
								LineStart: line.LineNum,
							}
						}
					}
					// if we find a `ChangeUnchanged`, we do one of two things:
					//
					// - if we're recording a change already, then we know
					// we've come to the end of that change block, so we write
					// that change out be recording the line number of where
					// that change ends, and append it to the current block's
					// summary.
					//
					// - if we're not recording a change, then we do nothing,
					// since the BasicDiff doesn't report on unchanged JSON
					// values.
				} else {
					if b.writing {
						b.writing = false
						b.Summary.LineEnd = line.LineNum
						b.Block.Summaries = append(b.Block.Summaries, b.Summary)
					}
				}
			}
		}
	}

	return blocks
}

// returnToTopLevelKey indicates that we've moved from a key at one level deep
// in the JSON document to a top level key.
//
// In order to produce distinct "blocks" when rendering the basic diff,
// we need a way to distinguish between different sections of data.
// To do this, we consider the value(s) of each top-level JSON key to
// represent a distinct block for Grafana's JSON data structure, so
// we perform this check to see if we've entered a new "block". If we
// have, we simply append the existing block to the array of blocks.
func (b *BasicDiff) returnToTopLevelKey(line *JSONLine) bool {
	return b.LastIndent == 2 && line.Indent == 1 && line.Change == ChangeNil
}

// handleTopLevelChange handles a change on one of the top-level keys on a JSON
// document.
//
// If the line's indentation is at level 1, then we know it's a top
// level key in the JSON document. As mentioned earlier, we treat these
// specially as they indicate their values belong to distinct blocks.
//
// At level 1, we only record single-line changes, ie, the "added",
// "deleted", "old" or "new" cases, since we know those values aren't
// arrays or maps. We only handle these cases at level 2 or deeper,
// since for those we either output a "change" or "summary". This is
// done for formatting reasons only, so we have logical "blocks" to
// display.
func (b *BasicDiff) handleTopLevelChange(line *JSONLine) (*BasicBlock, bool) {
	switch line.Change {
	case ChangeNil:
		if line.Change == ChangeNil {
			if line.Key != "" {
				b.Block = &BasicBlock{
					Title:  line.Key,
					Change: line.Change,
				}
			}
		}

	case ChangeAdded, ChangeDeleted:
		return &BasicBlock{
			Title:     line.Key,
			Change:    line.Change,
			New:       line.Val,
			LineStart: line.LineNum,
		}, true

	case ChangeOld:
		b.Block = &BasicBlock{
			Title:     line.Key,
			Old:       line.Val,
			Change:    line.Change,
			LineStart: line.LineNum,
		}

	case ChangeNew:
		b.Block.New = line.Val
		b.Block.LineEnd = line.LineNum

		// For every "old" change there is a corresponding "new", which
		// is why we wait until we detect the "new" change before
		// appending the change.
		return b.Block, true
	default:
		// ok
	}

	return nil, false
}

// isSingleLineChange ensures we're iterating over a single line change (ie,
// either a single line or a old-new value pair was changed in the JSON file).
func (b *BasicDiff) isSingleLineChange(line *JSONLine) bool {
	return line.Key != "" && line.Val != nil && !b.writing
}

// encStateMap is used in the template helper
var (
	encStateMap = map[ChangeType]string{
		ChangeAdded:   "added",
		ChangeDeleted: "deleted",
		ChangeOld:     "changed",
		ChangeNew:     "changed",
	}

	// tplFuncMap is the function map for each template
	tplFuncMap = template.FuncMap{
		"getChange": func(c ChangeType) string {
			state, ok := encStateMap[c]
			if !ok {
				return "changed"
			}
			return state
		},
	}
)

var (
	// tplBlock is the container for the basic diff. It iterates over each
	// basic block, expanding each "change" and "summary" belonging to every
	// block.
	tplBlock = `{{ define "block" -}}
{{ range . }}
<div class="diff-group">
	<div class="diff-block">
		<h2 class="diff-block-title">
			<i class="diff-circle diff-circle-{{ getChange .Change }} fa fa-circle"></i>
			<strong class="diff-title">{{ .Title }}</strong> {{ getChange .Change }}
		</h2>


		<!-- Overview -->
		{{ if .Old }}
			<div class="diff-label">{{ .Old }}</div>
			<i class="diff-arrow fa fa-long-arrow-right"></i>
		{{ end }}
		{{ if .New }}
				<div class="diff-label">{{ .New }}</div>
		{{ end }}

		{{ if .LineStart }}
			<diff-link-json
				line-link="{{ .LineStart }}"
				line-display="{{ .LineStart }}{{ if .LineEnd }} - {{ .LineEnd }}{{ end }}"
				switch-view="ctrl.getDiff('html')"
			/>
		{{ end }}

	</div>

	<!-- Basic Changes -->
	{{ range .Changes }}
		<ul class="diff-change-container">
		{{ template "change" . }}
		</ul>
	{{ end }}

	<!-- Basic Summary -->
	{{ range .Summaries }}
		{{ template "summary" . }}
	{{ end }}

</div>
{{ end }}
{{ end }}`

	// tplChange is the template for basic changes.
	tplChange = `{{ define "change" -}}
<li class="diff-change-group">
	<span class="bullet-position-container">
		<div class="diff-change-item diff-change-title">{{ getChange .Change }} {{ .Key }}</div>

		<div class="diff-change-item">
			{{ if .Old }}
				<div class="diff-label">{{ .Old }}</div>
				<i class="diff-arrow fa fa-long-arrow-right"></i>
			{{ end }}
			{{ if .New }}
					<div class="diff-label">{{ .New }}</div>
			{{ end }}
		</div>

		{{ if .LineStart }}
			<diff-link-json
				line-link="{{ .LineStart }}"
				line-display="{{ .LineStart }}{{ if .LineEnd }} - {{ .LineEnd }}{{ end }}"
				switch-view="ctrl.getDiff('json')"
			/>
		{{ end }}
	</span>
</li>
{{ end }}`

	// tplSummary is for basic summaries.
	tplSummary = `{{ define "summary" -}}
<div class="diff-group-name">
	<i class="diff-circle diff-circle-{{ getChange .Change }} fa fa-circle-o diff-list-circle"></i>

	{{ if .Count }}
		<strong>{{ .Count }}</strong>
	{{ end }}

	{{ if .Key }}
		<strong class="diff-summary-key">{{ .Key }}</strong>
		{{ getChange .Change }}
	{{ end }}

	{{ if .LineStart }}
		<diff-link-json
			line-link="{{ .LineStart }}"
			line-display="{{ .LineStart }}{{ if .LineEnd }} - {{ .LineEnd }}{{ end }}"
			switch-view="ctrl.getDiff('json')"
		/>
	{{ end }}
</div>
{{ end }}`
)
