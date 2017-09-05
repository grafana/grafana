package metrics

import "github.com/grafana/grafana/pkg/log"

type MetricMeta struct {
	tags map[string]string
	name string
}

func NewMetricMeta(name string, tagStrings []string) *MetricMeta {
	if len(tagStrings)%2 != 0 {
		log.Fatal(3, "Metrics: tags array is missing value for key, %v", tagStrings)
	}

	tags := make(map[string]string)
	for i := 0; i < len(tagStrings); i += 2 {
		tags[tagStrings[i]] = tagStrings[i+1]
	}

	return &MetricMeta{
		tags: tags,
		name: name,
	}
}

func (m *MetricMeta) Name() string {
	return m.name
}

func (m *MetricMeta) GetTagsCopy() map[string]string {
	if len(m.tags) == 0 {
		return make(map[string]string)
	}

	copy := make(map[string]string)
	for k2, v2 := range m.tags {
		copy[k2] = v2
	}

	return copy
}

func (m *MetricMeta) StringifyTags() string {
	if len(m.tags) == 0 {
		return ""
	}

	str := ""
	for key, value := range m.tags {
		str += "." + key + "_" + value
	}

	return str
}

type Metric interface {
	Name() string
	GetTagsCopy() map[string]string
	StringifyTags() string
}
