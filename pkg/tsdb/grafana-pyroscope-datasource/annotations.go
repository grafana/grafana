package pyroscope

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/dustin/go-humanize"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// profileAnnotationKey represents the key for different types of annotations
type profileAnnotationKey string

const (
	// profileAnnotationKeyThrottled is the key for throttling annotations
	profileAnnotationKeyThrottled profileAnnotationKey = "pyroscope.ingest.throttled"
)

// ProfileAnnotation represents the parsed annotation data
type ProfileAnnotation struct {
	Body ProfileThrottledAnnotation `json:"body"`
}

// ProfileThrottledAnnotation contains throttling information
type ProfileThrottledAnnotation struct {
	PeriodType        string  `json:"periodType"`
	PeriodLimitMb     float64 `json:"periodLimitMb"`
	LimitResetTime    int64   `json:"limitResetTime"`
	SamplingPeriodSec float64 `json:"samplingPeriodSec"`
	SamplingRequests  int64   `json:"samplingRequests"`
	UsageGroup        string  `json:"usageGroup"`
}

// processedProfileAnnotation represents a processed annotation ready for display
type processedProfileAnnotation struct {
	text             string
	time             int64
	timeEnd          int64
	isRegion         bool
	duplicateTracker int64
}

// grafanaAnnotationData holds slices of processed annotation data
type grafanaAnnotationData struct {
	times     []time.Time
	timeEnds  []time.Time
	texts     []string
	isRegions []bool
}

// convertAnnotation converts a Pyroscope profile annotation into a Grafana annotation
func convertAnnotation(timedAnnotation *TimedAnnotation, duplicateTracker int64) (*processedProfileAnnotation, error) {
	if timedAnnotation.getKey() != string(profileAnnotationKeyThrottled) {
		// Currently we only support throttling annotations
		return nil, nil
	}

	var profileAnnotation ProfileAnnotation
	err := json.Unmarshal([]byte(timedAnnotation.getValue()), &profileAnnotation)
	if err != nil {
		return nil, fmt.Errorf("error parsing annotation data: %w", err)
	}

	throttlingInfo := profileAnnotation.Body

	if duplicateTracker == throttlingInfo.LimitResetTime {
		return nil, nil
	}

	limit := humanize.IBytes(uint64(throttlingInfo.PeriodLimitMb * 1024 * 1024))
	return &processedProfileAnnotation{
		text:             fmt.Sprintf("Ingestion limit (%s/%s) reached", limit, throttlingInfo.PeriodType),
		time:             timedAnnotation.Timestamp,
		timeEnd:          throttlingInfo.LimitResetTime * 1000,
		isRegion:         throttlingInfo.LimitResetTime < time.Now().Unix(),
		duplicateTracker: throttlingInfo.LimitResetTime,
	}, nil
}

// processAnnotations processes a slice of TimedAnnotation and returns grafanaAnnotationData
func processAnnotations(timedAnnotations []*TimedAnnotation) (*grafanaAnnotationData, error) {
	result := &grafanaAnnotationData{
		times:     []time.Time{},
		timeEnds:  []time.Time{},
		texts:     []string{},
		isRegions: []bool{},
	}

	var duplicateTracker int64

	for _, timedAnnotation := range timedAnnotations {
		if timedAnnotation == nil || timedAnnotation.Annotation == nil {
			continue
		}
		processed, err := convertAnnotation(timedAnnotation, duplicateTracker)
		if err != nil {
			return nil, err
		}

		if processed != nil {
			result.times = append(result.times, time.UnixMilli(processed.time))
			result.timeEnds = append(result.timeEnds, time.UnixMilli(processed.timeEnd))
			result.isRegions = append(result.isRegions, processed.isRegion)
			result.texts = append(result.texts, processed.text)
			duplicateTracker = processed.duplicateTracker
		}
	}

	return result, nil
}

// createAnnotationFrame creates a data frame for annotations
func createAnnotationFrame(annotations []*TimedAnnotation) (*data.Frame, error) {
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
