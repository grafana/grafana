package influxdb

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/plugins"
)

type ResponseParser struct{}

var (
	legendFormat *regexp.Regexp
)

func init() {
	legendFormat = regexp.MustCompile(`\[\[([\@\/\w-]+)(\.[\@\/\w-]+)*\]\]*|\$(\$|\s*([\@\/\w-]+?)*)`)
}

// nolint:staticcheck // plugins.DataQueryResult deprecated
func (rp *ResponseParser) Parse(buf io.ReadCloser, query *Query) plugins.DataQueryResult {
	var queryRes plugins.DataQueryResult

	response, jsonErr := parseJSON(buf)
	if jsonErr != nil {
		queryRes.Error = jsonErr
		return queryRes
	}

	if response.Error != "" {
		queryRes.Error = fmt.Errorf(response.Error)
		return queryRes
	}

	frames := data.Frames{}
	for _, result := range response.Results {
		frames = append(frames, transformRows(result.Series, query)...)
		if result.Error != "" {
			queryRes.Error = fmt.Errorf(result.Error)
		}
	}
	queryRes.Dataframes = plugins.NewDecodedDataFrames(frames)

	return queryRes
}

func parseJSON(buf io.ReadCloser) (Response, error) {
	var response Response
	dec := json.NewDecoder(buf)
	dec.UseNumber()

	err := dec.Decode(&response)
	return response, err
}

func transformRows(rows []Row, query *Query) data.Frames {
	frames := data.Frames{}
	for _, row := range rows {
		for columnIndex, column := range row.Columns {
			if column == "time" {
				continue
			}

			var timeArray []time.Time
			var valueArray []*float64

			for _, valuePair := range row.Values {
				timestamp, timestampErr := parseTimestamp(valuePair[0])
				// we only add this row if the timestamp is valid
				if timestampErr == nil {
					value := parseValue(valuePair[columnIndex])
					timeArray = append(timeArray, timestamp)
					valueArray = append(valueArray, value)
				}
			}
			name := formatFrameName(row, column, query)

			timeField := data.NewField("time", nil, timeArray)
			valueField := data.NewField("value", row.Tags, valueArray)

			// set a nice name on the value-field
			valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: name})

			frames = append(frames, data.NewFrame(name, timeField, valueField))
		}
	}

	return frames
}

func subst(instr string) (retstr string, reterr error) {
	// catch panics
	defer func() {
		if r := recover(); r != nil {
			retstr = ""; reterr = fmt.Errorf("subst: %v", r) // %w?
		}
	}()

	in := strings.NewReader(instr)

	// helper: get next rune unless end-of-string; on end-of-string, return (0,io.EOF) if msg is empty, panic with msg otherwise
	nextchorerr := func(msg string) (rune, error) {
		if ch, _, err := in.ReadRune(); err == nil {
			return ch, nil
		} else if err == io.EOF {
			if msg == "" {
				return 0, io.EOF
			} else {
				panic("EOF in " + msg)
			}
		} else {
			panic("Error in " + msg)
		}
	}
	// get next rune; return (0,io.EOF) on end-of-string
	nextcherr := func() (rune, error) {
		return nextchorerr("")
	}
	// get next rune; panic with msg on end-of-string
	nextch := func(msg string) rune {
		if msg == "" {
			panic("nextch without msg")
		}
		ch, _ := nextchorerr(msg)
		return ch
	}

	var out strings.Builder
	for {
		var left, mid, right rune
		if ch, err := nextcherr(); err != nil {
			break
		} else if ch == '$' {
			left = nextch("after $")
			switch left {
			case '/':
				mid = '/'; right = '/'
			case '(':
				mid = '|'; right = ')'
			case '[':
				mid = '|'; right = ']'
			case '{':
				mid = '|'; right = '}'
			case '$':
				out.WriteRune('$')
				continue
			default:
				out.WriteRune(ch); out.WriteRune(left)
				continue
			}
		} else {
			out.WriteRune(ch)
			continue
		}
		more := true // more substitions in same command
		matched := false // had a match so far
		for more {
			var b strings.Builder
			// parse search (RE) part
LoopSrch:		for {
				ch := nextch("RE")
				switch ch {
				case '\\':
					b.WriteRune(nextch("escape sequence in RE"))
				case mid:
					break LoopSrch
				case right:
					panic("missing replace part")
				default:
					b.WriteRune(ch)
				}
			}
			srch := b.String(); b.Reset()
			re, err := regexp.Compile(srch)
			if err != nil {
				panic("invalid RE " + srch)
			}
			// parse replace part
LoopRepl:		for {
				ch := nextch("replace")
				switch ch {
				case '\\':
					b.WriteRune(nextch("escape sequence in replace"))
				case right:
					break LoopRepl
				default:
					b.WriteRune(ch)
				}
			}
			repl := b.String()

			// check if more substitutions follow in order to speed up code below
			if ch, err := nextcherr(); err != nil {
				more = false
			} else if ch != left {
				in.UnreadRune()
				more = false
			}

			// there seems to be no sane way to re.Replace*() and find out whether a replacement took place in case one needs backreferences
			replace := false // 1. set matched to true; 2. replace out with tmp
			var tmp string
			if matched {
				// already matched something, skip this
			} else if !more {
				// last replacement in command; no need to find out whether a replacement actually occured
				tmp = re.ReplaceAllString(out.String(), repl)
				replace = true
			} else if strings.IndexRune(repl, '$') < 0 {
				// no backreferences, use ReplaceAllStringFunc() func to find out whether replacement occured
				tmp = re.ReplaceAllStringFunc(out.String(), func(string) string {
					replace = true
					return repl
				})
			} else {
				// possible backreferences, use FindStringIndex() to find out whether replacement occured
				tmp = out.String()
				if re.FindStringIndex(tmp) != nil {
					tmp = re.ReplaceAllString(tmp, repl)
					replace = true
				}
			}
			if replace {
				matched = true
				out.Reset()
				out.WriteString(tmp)
			}

		}
	}

	return out.String(), nil
}

func formatFrameName(row Row, column string, query *Query) string {
	if query.Alias == "" {
		return buildFrameNameFromQuery(row, column)
	}
	nameSegment := strings.Split(row.Name, ".")

	result := legendFormat.ReplaceAllFunc([]byte(query.Alias), func(in []byte) []byte {
		aliasFormat := string(in)
		aliasFormat = strings.Replace(aliasFormat, "[[", "", 1)
		aliasFormat = strings.Replace(aliasFormat, "]]", "", 1)
		aliasFormat = strings.Replace(aliasFormat, "$", "", 1)

		if aliasFormat == "$" {
			return "$"
		}

		if aliasFormat == "m" || aliasFormat == "measurement" {
			return []byte(query.Measurement)
		}
		if aliasFormat == "col" {
			return []byte(column)
		}

		pos, err := strconv.Atoi(aliasFormat)
		if err == nil && len(nameSegment) >= pos {
			return []byte(nameSegment[pos])
		}

		if !strings.HasPrefix(aliasFormat, "tag_") {
			return in
		}

		tagKey := strings.Replace(aliasFormat, "tag_", "", 1)
		tagValue, exist := row.Tags[tagKey]
		if exist {
			return []byte(tagValue)
		}

		return in
	})

	if s, err := subst(string(result)); err == nil {
		return s
	} else {
		return in
	}
}

func buildFrameNameFromQuery(row Row, column string) string {
	var tags []string
	for k, v := range row.Tags {
		tags = append(tags, fmt.Sprintf("%s: %s", k, v))
	}

	tagText := ""
	if len(tags) > 0 {
		tagText = fmt.Sprintf(" { %s }", strings.Join(tags, " "))
	}

	return fmt.Sprintf("%s.%s%s", row.Name, column, tagText)
}

func parseTimestamp(value interface{}) (time.Time, error) {
	timestampNumber, ok := value.(json.Number)
	if !ok {
		return time.Time{}, fmt.Errorf("timestamp-value has invalid type: %#v", value)
	}
	timestampFloat, err := timestampNumber.Float64()
	if err != nil {
		return time.Time{}, err
	}

	// currently in the code the influxdb-timestamps are requested with
	// seconds-precision, meaning these values are seconds
	t := time.Unix(int64(timestampFloat), 0).UTC()

	return t, nil
}

func parseValue(value interface{}) *float64 {
	// NOTE: we use pointers-to-float64 because we need
	// to represent null-json-values. they come for example
	// when we do a group-by with fill(null)

	// FIXME: the value of an influxdb-query can be:
	// - string
	// - float
	// - integer
	// - boolean
	//
	// here we only handle numeric values. this is probably
	// enough for alerting, but later if we want to support
	// arbitrary queries, we will have to improve the code

	if value == nil {
		// this is what json-nulls become
		return nil
	}

	number, ok := value.(json.Number)
	if !ok {
		// in the current inmplementation, errors become nils
		return nil
	}

	fvalue, err := number.Float64()
	if err != nil {
		// in the current inmplementation, errors become nils
		return nil
	}

	return &fvalue
}
