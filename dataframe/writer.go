package dataframe

import (
	"io"
)

// Writer serializes a Frame into bytes.
type Writer struct {
	RefID string
	Frame *Frame
}

// Write writes the Frame to the supplied Writer.
func (w Writer) Write(wr io.Writer) error {
	b, err := toArrow(w.RefID, w.Frame)
	if err != nil {
		return err
	}
	_, err = wr.Write(b)
	return err
}
