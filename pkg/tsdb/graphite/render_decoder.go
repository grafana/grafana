package graphite

import (
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	pointValueValid uint8 = 1 << iota
	pointTimeValid
)

var (
	errDataPointTimestamp = errors.New("failed to parse data point timestamp")
	errRenderCapExceeded  = errors.New("render response cap exceeded")
)

type renderTooLargeError struct {
	maxBytes int64
}

func (e renderTooLargeError) Error() string {
	return fmt.Sprintf("response from Graphite /render exceeded %d bytes", e.maxBytes)
}

// cappedReader reads at most n bytes from r and fails once r holds more.
type cappedReader struct {
	r        io.Reader
	n        int64
	exceeded bool
	readErr  error
}

func (c *cappedReader) Read(p []byte) (int, error) {
	if c.exceeded {
		return 0, errRenderCapExceeded
	}
	if int64(len(p)) > c.n+1 {
		p = p[:c.n+1]
	}
	n, err := c.r.Read(p)
	if int64(n) > c.n {
		c.exceeded = true
		return int(c.n), errRenderCapExceeded
	}
	c.n -= int64(n)
	if err != nil && !errors.Is(err, io.EOF) {
		c.readErr = err
	}
	return n, err
}

// decodeRender streams a Graphite /render JSON body into the frames that
// toDataFrames builds from the same body.
func decodeRender(r io.Reader, maxBytes int64, refID string) (data.Frames, error) {
	body := &cappedReader{r: r, n: maxBytes}
	d := &renderDecoder{
		dec:    jsontext.NewDecoder(newNonFiniteReader(body), jsontext.AllowDuplicateNames(true), jsontext.AllowInvalidUTF8(true)),
		refID:  refID,
		frames: data.Frames{},
	}
	err := d.decode()
	switch {
	case body.exceeded:
		return nil, backend.DownstreamError(renderTooLargeError{maxBytes: maxBytes})
	case body.readErr != nil:
		return nil, backend.DownstreamError(body.readErr)
	case err != nil:
		return nil, err
	}
	return d.frames, nil
}

type renderDecoder struct {
	dec    *jsontext.Decoder
	refID  string
	frames data.Frames
	tsErr  error
	s      seriesBuffer
}

// seriesBuffer holds one series until its closing brace. Point slots outlive a
// repeated datapoints key, which encoding/json decodes into the earlier points.
type seriesBuffer struct {
	target  string
	labels  data.Labels
	hasName bool
	n       int
	values  []float64
	times   []float64
	valid   []uint8
}

func (s *seriesBuffer) reset() {
	s.target, s.labels, s.hasName = "", nil, false
	s.truncate()
}

func (s *seriesBuffer) truncate() {
	s.n = 0
	s.values, s.times, s.valid = s.values[:0], s.times[:0], s.valid[:0]
}

func (d *renderDecoder) decode() error {
	var err error
	switch d.dec.PeekKind() {
	case '[':
		err = d.seriesArray()
	case '{':
		err = d.legacy()
	case 'n':
		_, err = d.dec.ReadToken()
	default:
		err = d.unexpected("top-level value")
	}
	if err == nil {
		err = d.end()
	}
	if err != nil {
		return backend.PluginError(err)
	}
	return d.tsErr
}

func (d *renderDecoder) end() error {
	_, err := d.dec.ReadToken()
	switch {
	case err == nil:
		return errors.New("trailing data after the top-level value")
	case errors.Is(err, io.EOF):
		return nil
	}
	return err
}

// unexpected reads the next token so that a syntax error wins over a type error.
func (d *renderDecoder) unexpected(what string) error {
	tok, err := d.dec.ReadToken()
	if err != nil {
		return err
	}
	return fmt.Errorf("unexpected %s for %s", tok.Kind(), what)
}

func (d *renderDecoder) legacy() error {
	if _, err := d.dec.ReadToken(); err != nil {
		return err
	}
	for d.dec.PeekKind() != '}' {
		name, err := d.dec.ReadToken()
		if err != nil {
			return err
		}
		if !strings.EqualFold(name.String(), "series") {
			if err := d.dec.SkipValue(); err != nil {
				return err
			}
			continue
		}
		d.frames, d.tsErr = data.Frames{}, nil
		switch d.dec.PeekKind() {
		case '[':
			err = d.seriesArray()
		case 'n':
			_, err = d.dec.ReadToken()
		default:
			err = d.unexpected("series")
		}
		if err != nil {
			return err
		}
	}
	_, err := d.dec.ReadToken()
	return err
}

func (d *renderDecoder) seriesArray() error {
	if _, err := d.dec.ReadToken(); err != nil {
		return err
	}
	for d.dec.PeekKind() != ']' {
		var err error
		switch d.dec.PeekKind() {
		case '{':
			err = d.series()
		case 'n':
			if _, err = d.dec.ReadToken(); err == nil {
				d.s.reset()
				d.emit()
			}
		default:
			err = d.unexpected("series")
		}
		if err != nil {
			return err
		}
	}
	_, err := d.dec.ReadToken()
	return err
}

func (d *renderDecoder) series() error {
	d.s.reset()
	if _, err := d.dec.ReadToken(); err != nil {
		return err
	}
	for d.dec.PeekKind() != '}' {
		name, err := d.dec.ReadToken()
		if err != nil {
			return err
		}
		switch key := name.String(); {
		case strings.EqualFold(key, "target"):
			err = d.target()
		case strings.EqualFold(key, "tags"):
			err = d.tags()
		case strings.EqualFold(key, "datapoints"):
			err = d.datapoints()
		default:
			err = d.dec.SkipValue()
		}
		if err != nil {
			return err
		}
	}
	if _, err := d.dec.ReadToken(); err != nil {
		return err
	}
	d.emit()
	return nil
}

func (d *renderDecoder) target() error {
	switch d.dec.PeekKind() {
	case '"':
		tok, err := d.dec.ReadToken()
		if err != nil {
			return err
		}
		d.s.target = tok.String()
		return nil
	case 'n':
		_, err := d.dec.ReadToken()
		return err
	default:
		return d.unexpected("target")
	}
}

func (d *renderDecoder) tags() error {
	s := &d.s
	switch d.dec.PeekKind() {
	case '{':
	case 'n':
		s.labels, s.hasName = nil, false
		_, err := d.dec.ReadToken()
		return err
	default:
		return d.unexpected("tags")
	}
	if _, err := d.dec.ReadToken(); err != nil {
		return err
	}
	if s.labels == nil {
		s.labels = data.Labels{}
	}
	for d.dec.PeekKind() != '}' {
		name, err := d.dec.ReadToken()
		if err != nil {
			return err
		}
		key := name.String()
		if key == "name" {
			s.hasName = true
			if err := d.dec.SkipValue(); err != nil {
				return err
			}
			continue
		}
		switch d.dec.PeekKind() {
		case '"':
			tok, err := d.dec.ReadToken()
			if err != nil {
				return err
			}
			s.labels[key] = tok.String()
		case '0':
			tok, err := d.dec.ReadToken()
			if err != nil {
				return err
			}
			v, err := tok.Float()
			if err != nil && !errors.Is(err, strconv.ErrRange) {
				return err
			}
			s.labels[key] = strconv.FormatFloat(v, 'f', -1, 64)
		default:
			delete(s.labels, key)
			if err := d.dec.SkipValue(); err != nil {
				return err
			}
		}
	}
	_, err := d.dec.ReadToken()
	return err
}

func (d *renderDecoder) datapoints() error {
	s := &d.s
	switch d.dec.PeekKind() {
	case '[':
	case 'n':
		s.truncate()
		_, err := d.dec.ReadToken()
		return err
	default:
		return d.unexpected("datapoints")
	}
	if _, err := d.dec.ReadToken(); err != nil {
		return err
	}
	i := 0
	for ; d.dec.PeekKind() != ']'; i++ {
		if i == len(s.values) {
			s.values = append(s.values, 0)
			s.times = append(s.times, 0)
			s.valid = append(s.valid, 0)
		}
		var err error
		switch d.dec.PeekKind() {
		case '[':
			err = d.point(i)
		case 'n':
			_, err = d.dec.ReadToken()
		default:
			err = d.unexpected("datapoint")
		}
		if err != nil {
			return err
		}
	}
	s.n = i
	if i == 0 {
		s.truncate()
	}
	_, err := d.dec.ReadToken()
	return err
}

func (d *renderDecoder) point(i int) error {
	s := &d.s
	if _, err := d.dec.ReadToken(); err != nil {
		return err
	}
	j := 0
	for ; d.dec.PeekKind() != ']'; j++ {
		var err error
		switch j {
		case 0:
			err = d.pointElement(&s.values[i], &s.valid[i], pointValueValid)
		case 1:
			err = d.pointElement(&s.times[i], &s.valid[i], pointTimeValid)
		default:
			err = d.dec.SkipValue()
		}
		if err != nil {
			return err
		}
	}
	if j < 1 {
		s.values[i] = 0
		s.valid[i] &^= pointValueValid
	}
	if j < 2 {
		s.times[i] = 0
		s.valid[i] &^= pointTimeValid
	}
	_, err := d.dec.ReadToken()
	return err
}

// pointElement decodes a value or timestamp into the slot at v, updating its
// bit in valid. Out-of-range values become ±Inf, out-of-range timestamps fail.
func (d *renderDecoder) pointElement(v *float64, valid *uint8, bit uint8) error {
	switch d.dec.PeekKind() {
	case '0':
		tok, err := d.dec.ReadToken()
		if err != nil {
			return err
		}
		f, err := tok.Float()
		if err != nil && (bit == pointTimeValid || !errors.Is(err, strconv.ErrRange)) {
			return err
		}
		*v = f
		*valid |= bit
		return nil
	case 'n':
		*valid &^= bit
		_, err := d.dec.ReadToken()
		return err
	default:
		return d.floatElement(v, valid, bit)
	}
}

// floatElement decodes other forms, such as the sql.NullFloat64 object,
// through Float for parity with toDataFrames.
func (d *renderDecoder) floatElement(v *float64, valid *uint8, bit uint8) error {
	raw, err := d.dec.ReadValue()
	if err != nil {
		return err
	}
	f := NewFloat(*v, *valid&bit != 0)
	if err := f.UnmarshalJSON(raw); err != nil {
		return err
	}
	*v = f.Float64
	if f.Valid {
		*valid |= bit
	} else {
		*valid &^= bit
	}
	return nil
}

// emit appends the buffered series as a frame. A missing timestamp is
// reported once the whole body has parsed, as toDataFrames does.
func (d *renderDecoder) emit() {
	s := &d.s
	if d.tsErr != nil {
		return
	}
	nonNull := 0
	for _, v := range s.valid[:s.n] {
		if v&pointTimeValid == 0 {
			d.frames, d.tsErr = nil, errDataPointTimestamp
			return
		}
		if v&pointValueValid != 0 {
			nonNull++
		}
	}

	timeField := data.NewFieldFromFieldType(data.FieldTypeTime, s.n)
	timeField.Name = "time"
	valueField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, s.n)
	valueField.Name = "value"
	values := make([]float64, 0, nonNull)
	for i := range s.n {
		*timeField.PointerAt(i).(*time.Time) = time.Unix(int64(s.times[i]), 0).UTC()
		if s.valid[i]&pointValueValid != 0 {
			values = append(values, s.values[i])
			valueField.Set(i, &values[len(values)-1])
		}
	}

	labels := s.labels
	if labels == nil {
		labels = data.Labels{}
	}
	if s.hasName {
		name := s.target
		if idx := strings.IndexByte(name, ';'); idx != -1 {
			name = name[:idx]
		}
		labels["name"] = name
	}
	valueField.Labels = labels
	valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: s.target})

	frame := data.NewFrame("", timeField, valueField).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti})
	frame.RefID = d.refID
	d.frames = append(d.frames, frame)
}

func (s *Service) decodeRenderResponse(res *http.Response, refID string) (data.Frames, error) {
	defer func() {
		if err := res.Body.Close(); err != nil {
			s.logger.Warn("Failed to close response body", "err", err)
		}
	}()

	maxBytes := s.caps.renderResponse()
	frames, err := decodeRender(res.Body, maxBytes, refID)
	if err != nil {
		if errors.As(err, new(renderTooLargeError)) {
			s.logger.Error("Graphite /render response exceeded the configured cap", "max_bytes", maxBytes)
		} else {
			s.logger.Info("Failed to decode graphite response", "error", err, "status", res.Status)
		}
		return nil, err
	}
	for _, frame := range frames {
		s.logger.Debug("Graphite response", "target", frame.Fields[1].Config.DisplayNameFromDS, "datapoints", frame.Rows())
	}
	return frames, nil
}
