package stats

import (
	"fmt"
	"strings"
	"time"
)

const (
	// dailySection holds the per-day buckets: the source of truth.
	dailySection = "stats/daily"
	// aggregatesSection holds the derived window cache for the index.
	aggregatesSection = "stats/aggregates"

	// overflowBucket is the day value for the bucket holding the sum of
	// everything older than MaxWindow days. It sorts after real YYYY-MM-DD
	// day keys so prefix scans see it last.
	overflowBucket = "overflow"

	// dayLayout is the UTC day-bucket format.
	dayLayout = "2006-01-02"
)

// objectRef identifies a single tracked object.
type objectRef struct {
	Group     string
	Resource  string
	Namespace string
	Name      string
}

func (o objectRef) prefix() string {
	return strings.Join([]string{o.Group, o.Resource, o.Namespace, o.Name}, "/") + "/"
}

// dailyKey builds {group}/{resource}/{namespace}/{name}/{day}/{metric}.
func dailyKey(o objectRef, day, metric string) string {
	return o.prefix() + day + "/" + metric
}

// aggregateKey builds {group}/{resource}/{namespace}/{name}/{field}.
func aggregateKey(o objectRef, field string) string {
	return o.prefix() + field
}

// namespacePrefix builds {group}/{resource}/{namespace}/ for prefix scans.
func namespacePrefix(group, resource, namespace string) string {
	return strings.Join([]string{group, resource, namespace}, "/") + "/"
}

// parsedDailyKey is the decomposition of a daily key.
type parsedDailyKey struct {
	objectRef
	Day    string
	Metric string
}

func parseDailyKey(key string) (parsedDailyKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) != 6 {
		return parsedDailyKey{}, fmt.Errorf("invalid daily key %q", key)
	}
	return parsedDailyKey{
		objectRef: objectRef{
			Group:     parts[0],
			Resource:  parts[1],
			Namespace: parts[2],
			Name:      parts[3],
		},
		Day:    parts[4],
		Metric: parts[5],
	}, nil
}

// parsedAggregateKey is the decomposition of an aggregates key.
type parsedAggregateKey struct {
	objectRef
	Field string
}

func parseAggregateKey(key string) (parsedAggregateKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) != 5 {
		return parsedAggregateKey{}, fmt.Errorf("invalid aggregate key %q", key)
	}
	return parsedAggregateKey{
		objectRef: objectRef{
			Group:     parts[0],
			Resource:  parts[1],
			Namespace: parts[2],
			Name:      parts[3],
		},
		Field: parts[4],
	}, nil
}

// dayString returns the UTC day bucket for a unix timestamp (seconds).
func dayString(unix int64) string {
	return time.Unix(unix, 0).UTC().Format(dayLayout)
}

// parseDay parses a YYYY-MM-DD bucket into a UTC time at midnight.
func parseDay(day string) (time.Time, error) {
	return time.Parse(dayLayout, day)
}
