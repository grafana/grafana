package cloudwatch

import (
	"math"
	"strings"
	"time"
)

type cloudWatchQuery struct {
	RefId                   string
	Region                  string
	Id                      string
	Namespace               string
	MetricName              string
	Stats                   string
	Expression              string
	ReturnData              bool
	Dimensions              map[string][]string
	Period                  int
	RequestedPeriod         int
	Alias                   string
	MatchExact              bool
	UsedExpression          string
	RequestExceededMaxLimit bool
}

func (q *cloudWatchQuery) isMathExpression() bool {
	return q.Expression != "" && !q.isUserDefinedSearchExpression()
}

func (q *cloudWatchQuery) isSearchExpression() bool {
	return q.isUserDefinedSearchExpression() || q.isInferredSearchExpression()
}

func (q *cloudWatchQuery) isUserDefinedSearchExpression() bool {
	return strings.Contains(q.Expression, "SEARCH(")
}

func (q *cloudWatchQuery) isInferredSearchExpression() bool {
	if len(q.Dimensions) == 0 {
		return !q.MatchExact
	}

	if !q.MatchExact {
		return true
	}

	for _, values := range q.Dimensions {
		if len(values) > 1 {
			return true
		}
		for _, v := range values {
			if v == "*" {
				return true
			}
		}
	}
	return false
}

func (q *cloudWatchQuery) isMetricStat() bool {
	return !q.isSearchExpression() && !q.isMathExpression()
}

func (q *cloudWatchQuery) setPeriod(startTime time.Time, endTime time.Time, batchContainsWildcard bool, noOfQueries int) {
	if q.RequestedPeriod == 0 {
		delta := endTime.Sub(startTime)
		if batchContainsWildcard {
			if math.Ceil(delta.Hours()) <= 24*15 {
				// until 15 days
				if q.Namespace == "AWS/EC2" {
					q.Period = 300
				} else {
					q.Period = 60
				}
			} else if math.Ceil(delta.Hours()) <= 24*63 {
				// until 63 days
				q.Period = 300
			} else {
				// more than 63 days
				q.Period = 3600
			}
		} else {
			hours := math.Ceil(delta.Hours())
			datapointsPerSecond := 90000
			if hours <= 3 {
				datapointsPerSecond = 180000
			}
			q.Period = int(math.Ceil(float64(delta.Milliseconds()/1000/60)/(float64(datapointsPerSecond)/float64(noOfQueries))) * 60)
		}
	} else {
		// period that was specified in the query editor is being used
		q.Period = q.RequestedPeriod
	}
}
