package exemplar

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var _ data.Framer = (*Framer)(nil)

type Framer struct {
	frames       data.Frames
	sampler      Sampler
	labelTracker LabelTracker
	meta         *data.FrameMeta
	refID        string
}

func NewFramer(sampler Sampler, labelTracker LabelTracker) *Framer {
	return &Framer{
		frames:       data.Frames{},
		sampler:      sampler,
		labelTracker: labelTracker,
	}
}

func (f *Framer) SetMeta(meta *data.FrameMeta) {
	f.meta = meta
}

func (f *Framer) SetRefID(refID string) {
	f.refID = refID
}

func (f *Framer) AddFrame(frame *data.Frame) {
	f.frames = append(f.frames, frame)
}

func (f *Framer) Frames() (data.Frames, error) {
	exemplars := f.sampler.Sample()
	f.sampler.Reset()

	if len(exemplars) == 0 {
		return f.frames, nil
	}

	// the new exemplar frame will be a single frame in long format
	// with a timestamp, metric value, and one or more label fields
	exemplarFrame := data.NewFrame("exemplar")
	exemplarFrame.RefID = f.refID
	exemplarFrame.Meta = f.meta

	// init the fields for the new exemplar frame
	timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, make([]time.Time, 0, len(exemplars)))
	valueField := data.NewField(data.TimeSeriesValueFieldName, nil, make([]float64, 0, len(exemplars)))
	exemplarFrame.Fields = append(exemplarFrame.Fields, timeField, valueField)
	labelNames := f.labelTracker.GetNames()
	for _, labelName := range labelNames {
		exemplarFrame.Fields = append(exemplarFrame.Fields, data.NewField(labelName, nil, make([]string, 0, len(exemplars))))
	}

	// add the sampled exemplars to the new exemplar frame
	for _, b := range exemplars {
		timeField.Append(b.Timestamp)
		valueField.Append(b.Value)
		for i, labelName := range labelNames {
			labelValue, ok := b.Labels[labelName]
			if !ok {
				// if the label is not present in the exemplar labels, then use the series label
				labelValue = b.SeriesLabels[labelName]
			}
			colIdx := i + 2 // +2 to skip time and value fields
			exemplarFrame.Fields[colIdx].Append(labelValue)
		}
	}

	f.frames = append(f.frames, exemplarFrame)

	return f.frames, nil
}
