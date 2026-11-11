package schedule

import (
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/ngalert/writer"
)

// seriesTarget is part of a series' identity: the same labels in another data source,
// org or metric are another series.
type seriesTarget struct {
	dsUID string
	orgID int64
	name  string
}

type seriesSet map[data.Fingerprint]data.Labels

// writtenSeries is memory only, so a restart or a move to another instance forgets it.
type writtenSeries map[seriesTarget]seriesSet

func newWrittenSeries(dsUID string, orgID int64, name string, points []writer.Point) writtenSeries {
	if len(points) == 0 {
		return nil
	}

	set := make(seriesSet, len(points))
	for _, p := range points {
		labels := withoutEmptyValues(p.Labels)
		set[labels.Fingerprint()] = labels
	}
	return writtenSeries{{dsUID: dsUID, orgID: orgID, name: name}: set}
}

// withoutEmptyValues drops empty labels because Prometheus treats them as absent.
// Otherwise adding one would make a live series look like a new one.
func withoutEmptyValues(labels map[string]string) data.Labels {
	out := make(data.Labels, len(labels))
	for name, value := range labels {
		if value != "" {
			out[name] = value
		}
	}
	return out
}

func (s writtenSeries) missingFrom(current writtenSeries) writtenSeries {
	var missing writtenSeries
	for target, set := range s {
		for fp, labels := range set {
			if _, ok := current[target][fp]; ok {
				continue
			}
			if missing == nil {
				missing = make(writtenSeries)
			}
			if missing[target] == nil {
				missing[target] = make(seriesSet)
			}
			missing[target][fp] = labels
		}
	}
	return missing
}

func (s writtenSeries) merge(other writtenSeries) writtenSeries {
	if len(other) == 0 {
		return s
	}
	if s == nil {
		s = make(writtenSeries, len(other))
	}
	for target, set := range other {
		if s[target] == nil {
			s[target] = make(seriesSet, len(set))
		}
		for fp, labels := range set {
			s[target][fp] = labels
		}
	}
	return s
}

func (s writtenSeries) labelSets(target seriesTarget) []map[string]string {
	set := s[target]
	out := make([]map[string]string, 0, len(set))
	for _, labels := range set {
		out = append(out, labels)
	}
	return out
}

// errNoData marks an empty result, as opposed to a response we could not read.
var errNoData = errors.New("no data")
