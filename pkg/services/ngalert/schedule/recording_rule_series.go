package schedule

import (
	"errors"
	"sort"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/writer"
)

// seriesTarget is part of a series' identity: the same labels in another data source,
// org or metric are another series.
type seriesTarget struct {
	dsUID string
	orgID int64
	name  string
}

// writtenSeries is memory only, so a restart or a move to another instance forgets it.
type writtenSeries map[seriesTarget]map[string]map[string]string

func newWrittenSeries(dsUID string, orgID int64, name string, points []writer.Point) writtenSeries {
	if len(points) == 0 {
		return nil
	}

	set := make(map[string]map[string]string, len(points))
	for _, p := range points {
		set[labelSetKey(p.Labels)] = p.Labels
	}
	return writtenSeries{{dsUID: dsUID, orgID: orgID, name: name}: set}
}

func (s writtenSeries) missingFrom(current writtenSeries) writtenSeries {
	var missing writtenSeries
	for target, set := range s {
		for key, labels := range set {
			if _, ok := current[target][key]; ok {
				continue
			}
			if missing == nil {
				missing = make(writtenSeries)
			}
			if missing[target] == nil {
				missing[target] = make(map[string]map[string]string)
			}
			missing[target][key] = labels
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
			s[target] = make(map[string]map[string]string, len(set))
		}
		for key, labels := range set {
			s[target][key] = labels
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

// Length prefixes keep different label sets from encoding to the same key.
func labelSetKey(labels map[string]string) string {
	names := make([]string, 0, len(labels))
	for name := range labels {
		names = append(names, name)
	}
	sort.Strings(names)

	var b strings.Builder
	for _, name := range names {
		value := labels[name]
		b.WriteString(strconv.Itoa(len(name)))
		b.WriteByte(':')
		b.WriteString(name)
		b.WriteString(strconv.Itoa(len(value)))
		b.WriteByte(':')
		b.WriteString(value)
	}
	return b.String()
}

// errNoData marks an empty result, as opposed to a response we could not read.
var errNoData = errors.New("no data")
