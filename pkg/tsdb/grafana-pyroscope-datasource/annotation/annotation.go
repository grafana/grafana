package annotation

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	typesv1 "github.com/grafana/pyroscope/api/gen/proto/go/types/v1"
)

type TimedAnnotation struct {
	Timestamp  int64                      `json:"timestamp"`
	Annotation *typesv1.ProfileAnnotation `json:"annotation"`
}

func (ta *TimedAnnotation) getKey() string {
	return ta.Annotation.Key
}

func (ta *TimedAnnotation) getValue() string {
	return ta.Annotation.Value
}

type profileAnnotationKey string

const (
	// ProfileAnnotationKeyThrottled is an identifier for throttling annotations
	ProfileAnnotationKeyThrottled profileAnnotationKey = "pyroscope.ingest.throttled"
	// ProfileAnnotationKeySampled is an identifier for sampling annotations
	ProfileAnnotationKeySampled profileAnnotationKey = "pyroscope.ingest.sampled"
)

type processedProfileAnnotation struct {
	id       string
	text     string
	time     int64
	timeEnd  int64
	isRegion bool
}

type grafanaAnnotationData struct {
	ids       []string
	times     []time.Time
	timeEnds  []time.Time
	texts     []string
	isRegions []bool
}

func (ga *grafanaAnnotationData) add(a *processedProfileAnnotation) {
	// simple de-duplication, assuming annotations are ordered
	if len(ga.ids) > 0 {
		lastIdx := len(ga.ids) - 1
		if a.id == ga.ids[lastIdx] {
			// duplicate annotation, extend the previous annotation and discard the rest
			ga.timeEnds[lastIdx] = time.UnixMilli(a.timeEnd)
			return
		}
	}
	ga.ids = append(ga.ids, a.id)
	ga.times = append(ga.times, time.UnixMilli(a.time))
	ga.timeEnds = append(ga.timeEnds, time.UnixMilli(a.timeEnd))
	ga.isRegions = append(ga.isRegions, a.isRegion)
	ga.texts = append(ga.texts, a.text)
}

// convertAnnotation converts a Pyroscope profile annotation into a Grafana annotation
func convertAnnotation(timedAnnotation *TimedAnnotation) (*processedProfileAnnotation, error) {
	switch timedAnnotation.getKey() {
	case string(ProfileAnnotationKeySampled):
		return convertSamplingAnnotation(timedAnnotation.getValue(), timedAnnotation.Timestamp)
	case string(ProfileAnnotationKeyThrottled):
		return convertThrottlingAnnotation(timedAnnotation.getValue(), timedAnnotation.Timestamp)
	default:
		// Currently, we only support throttling and sampling annotations
		return nil, nil
	}
}

func processAnnotations(timedAnnotations []*TimedAnnotation) (*grafanaAnnotationData, error) {
	result := &grafanaAnnotationData{
		times:     []time.Time{},
		timeEnds:  []time.Time{},
		texts:     []string{},
		isRegions: []bool{},
	}

	for _, timedAnnotation := range timedAnnotations {
		if timedAnnotation == nil || timedAnnotation.Annotation == nil {
			continue
		}
		processed, err := convertAnnotation(timedAnnotation)
		if err != nil {
			return nil, err
		}

		if processed != nil {
			result.add(processed)
		}
	}

	return result, nil
}

// CreateAnnotationFrame creates a Grafana data frame from annotation data
func CreateAnnotationFrame(annotations []*TimedAnnotation) (*data.Frame, error) {
	annotationData, err := processAnnotations(annotations)
	if err != nil {
		return nil, err
	}

	timeField := data.NewField("time", nil, annotationData.times)
	timeEndField := data.NewField("timeEnd", nil, annotationData.timeEnds)
	textField := data.NewField("text", nil, annotationData.texts)
	isRegionField := data.NewField("isRegion", nil, annotationData.isRegions)
	colorField := data.NewField("color", nil, make([]string, len(annotationData.times)))

	frame := data.NewFrame("annotations")
	frame.Fields = data.Fields{timeField, timeEndField, textField, isRegionField, colorField}
	frame.SetMeta(&data.FrameMeta{
		DataTopic: data.DataTopicAnnotations,
	})

	return frame, nil
}
