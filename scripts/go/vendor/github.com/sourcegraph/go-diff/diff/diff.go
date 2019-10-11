package diff

import "bytes"

// NOTE: types are code-generated in diff.pb.go.

//go:generate protoc -I../../../.. -I ../../../../github.com/gogo/protobuf/protobuf -I. --gogo_out=. diff.proto

// Stat computes the number of lines added/changed/deleted in all
// hunks in this file's diff.
func (d *FileDiff) Stat() Stat {
	total := Stat{}
	for _, h := range d.Hunks {
		total.add(h.Stat())
	}
	return total
}

// Stat computes the number of lines added/changed/deleted in this
// hunk.
func (h *Hunk) Stat() Stat {
	lines := bytes.Split(h.Body, []byte{'\n'})
	var last byte
	st := Stat{}
	for _, line := range lines {
		if len(line) == 0 {
			last = 0
			continue
		}
		switch line[0] {
		case '-':
			if last == '+' {
				st.Added--
				st.Changed++
				last = 0 // next line can't change this one since this is already a change
			} else {
				st.Deleted++
				last = line[0]
			}
		case '+':
			if last == '-' {
				st.Deleted--
				st.Changed++
				last = 0 // next line can't change this one since this is already a change
			} else {
				st.Added++
				last = line[0]
			}
		default:
			last = 0
		}
	}
	return st
}

var (
	hunkPrefix = []byte("@@ ")
)

const hunkHeader = "@@ -%d,%d +%d,%d @@"

// diffTimeParseLayout is the layout used to parse the time in unified diff file
// header timestamps.
// See https://www.gnu.org/software/diffutils/manual/html_node/Detailed-Unified.html.
const diffTimeParseLayout = "2006-01-02 15:04:05 -0700"

// diffTimeFormatLayout is the layout used to format (i.e., print) the time in unified diff file
// header timestamps.
// See https://www.gnu.org/software/diffutils/manual/html_node/Detailed-Unified.html.
const diffTimeFormatLayout = "2006-01-02 15:04:05.000000000 -0700"

func (s *Stat) add(o Stat) {
	s.Added += o.Added
	s.Changed += o.Changed
	s.Deleted += o.Deleted
}
