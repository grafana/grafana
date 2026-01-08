package annotation

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/dustin/go-humanize"
)

type annotationWithThrottlingBody struct {
	Body profileThrottledAnnotation `json:"body"`
}

type profileThrottledAnnotation struct {
	PeriodType        string  `json:"periodType"`
	PeriodLimitMb     float64 `json:"periodLimitMb"`
	LimitResetTime    int64   `json:"limitResetTime"`
	SamplingPeriodSec float64 `json:"samplingPeriodSec"`
	SamplingRequests  int64   `json:"samplingRequests"`
	UsageGroup        string  `json:"usageGroup"`
}

func convertThrottlingAnnotation(raw string, timestamp int64) (*processedProfileAnnotation, error) {
	var profileAnnotation annotationWithThrottlingBody
	err := json.Unmarshal([]byte(raw), &profileAnnotation)
	if err != nil {
		return nil, fmt.Errorf("error parsing annotation data: %w", err)
	}

	throttlingInfo := profileAnnotation.Body
	limit := humanize.IBytes(uint64(throttlingInfo.PeriodLimitMb * 1024 * 1024))
	id := fmt.Sprintf("%s-%s-%d", throttlingInfo.PeriodType, limit, throttlingInfo.LimitResetTime)

	return &processedProfileAnnotation{
		id:       id,
		text:     fmt.Sprintf("Ingestion limit (%s/%s) reached", limit, throttlingInfo.PeriodType),
		time:     timestamp,
		timeEnd:  throttlingInfo.LimitResetTime * 1000,
		isRegion: throttlingInfo.LimitResetTime < time.Now().Unix(),
	}, nil
}
