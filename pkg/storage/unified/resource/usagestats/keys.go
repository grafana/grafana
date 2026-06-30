package usagestats

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	dailySection      = kv.StatsDailySection
	aggregatesSection = kv.StatsAggregatesSection

	// overflowBucket is the day value for the bucket holding the sum of
	// everything older than MaxWindow days.
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

func dailyKey(o objectRef, day, metric string) string {
	return strings.Join([]string{o.Group, o.Resource, o.Namespace, o.Name, day, metric}, "/")
}

func aggregateKey(o objectRef, field string) string {
	return strings.Join([]string{o.Group, o.Resource, o.Namespace, o.Name, field}, "/")
}

func namespacePrefix(group, resource, namespace string) string {
	return strings.Join([]string{group, resource, namespace}, "/") + "/"
}

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

func dayString(unix int64) string {
	return time.Unix(unix, 0).UTC().Format(dayLayout)
}

func parseDay(day string) (time.Time, error) {
	return time.Parse(dayLayout, day)
}
