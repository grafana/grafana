package annotation

import (
	"encoding/json"
	"fmt"
)

type annotationWithSamplingBody struct {
	Body profileSampledAnnotation `json:"body"`
}

type profileSampledAnnotation struct {
	Source *samplingSource `json:"source"`
}

type samplingSource struct {
	UsageGroup  string  `json:"usageGroup"`
	Probability float64 `json:"probability"`
}

func convertSamplingAnnotation(raw string, timestamp int64) (*processedProfileAnnotation, error) {
	var profileAnnotation annotationWithSamplingBody
	err := json.Unmarshal([]byte(raw), &profileAnnotation)
	if err != nil {
		return nil, fmt.Errorf("error parsing annotation data: %w", err)
	}
	if profileAnnotation.Body.Source == nil {
		return nil, fmt.Errorf("error parsing sampling annotation data: source is nil")
	}

	samplingInfo := profileAnnotation.Body.Source
	if samplingInfo.Probability == 1.0 {
		return nil, nil
	}

	droppedPercentage := (1 - samplingInfo.Probability) * 100
	id := fmt.Sprintf("%s-%.0f", samplingInfo.UsageGroup, droppedPercentage)
	text := fmt.Sprintf("%.2f%% of profiles for this service have been dropped by sampling rules", droppedPercentage)

	return &processedProfileAnnotation{
		id:       id,
		text:     text,
		time:     timestamp,
		timeEnd:  timestamp,
		isRegion: true,
	}, nil
}
