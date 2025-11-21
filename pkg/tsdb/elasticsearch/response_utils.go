package elasticsearch

import (
	"errors"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

// flatten flattens multi-level objects to single level objects. It uses dot notation to join keys.
func flatten(target map[string]interface{}, maxDepth int) map[string]interface{} {
	// On frontend maxDepth wasn't used but as we are processing on backend
	// let's put a limit to avoid infinite loop. 10 was chosen arbitrary.
	output := make(map[string]interface{})
	step(0, maxDepth, target, "", output)
	return output
}

// step is a recursive helper for flatten
func step(currentDepth, maxDepth int, target map[string]interface{}, prev string, output map[string]interface{}) {
	nextDepth := currentDepth + 1
	for key, value := range target {
		newKey := strings.Trim(prev+"."+key, ".")

		v, ok := value.(map[string]interface{})
		if ok && len(v) > 0 && currentDepth < maxDepth {
			step(nextDepth, maxDepth, v, newKey, output)
		} else {
			output[newKey] = value
		}
	}
}

// sortPropNames orders propNames so that timeField is first (if it exists), log message field is second
// if shouldSortLogMessageField is true, and rest of propNames are ordered alphabetically
func sortPropNames(propNames map[string]bool, configuredFields es.ConfiguredFields, shouldSortLogMessageField bool) []string {
	hasTimeField := false
	hasLogMessageField := false

	var sortedPropNames []string
	for k := range propNames {
		if configuredFields.TimeField != "" && k == configuredFields.TimeField {
			hasTimeField = true
		} else if shouldSortLogMessageField && configuredFields.LogMessageField != "" && k == configuredFields.LogMessageField {
			hasLogMessageField = true
		} else {
			sortedPropNames = append(sortedPropNames, k)
		}
	}

	sort.Strings(sortedPropNames)

	if hasLogMessageField {
		sortedPropNames = append([]string{configuredFields.LogMessageField}, sortedPropNames...)
	}

	if hasTimeField {
		sortedPropNames = append([]string{configuredFields.TimeField}, sortedPropNames...)
	}

	return sortedPropNames
}

// castToInt casts a simplejson.Json value to int
func castToInt(j *simplejson.Json) (int, error) {
	i, err := j.Int()
	if err == nil {
		return i, nil
	}

	s, err := j.String()
	if err != nil {
		return 0, err
	}

	v, err := strconv.Atoi(s)
	if err != nil {
		return 0, err
	}

	return v, nil
}

// castToFloat casts a simplejson.Json value to float64
func castToFloat(j *simplejson.Json) *float64 {
	f, err := j.Float64()
	if err == nil {
		return &f
	}

	if s, err := j.String(); err == nil {
		if strings.ToLower(s) == "nan" {
			return nil
		}

		if v, err := strconv.ParseFloat(s, 64); err == nil {
			return &v
		}
	}

	return nil
}

// getAsTime converts a simplejson.Json value to time.Time
func getAsTime(j *simplejson.Json) (time.Time, error) {
	// these are stored as numbers
	number, err := j.Float64()
	if err != nil {
		return time.Time{}, err
	}

	return time.UnixMilli(int64(number)).UTC(), nil
}

// findAgg finds a bucket aggregation by ID
func findAgg(target *Query, aggID string) (*BucketAgg, error) {
	for _, v := range target.BucketAggs {
		if aggID == v.ID {
			return v, nil
		}
	}
	return nil, errors.New("can't found aggDef, aggID:" + aggID)
}
