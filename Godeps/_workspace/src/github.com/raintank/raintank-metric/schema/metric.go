package schema

import (
	"bytes"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"sort"
	"time"
)

//go:generate msgp

// MetricData contains all metric metadata and a datapoint
type MetricData struct {
	OrgId      int               `json:"org_id"`
	Name       string            `json:"name"`
	Metric     string            `json:"metric"`
	Interval   int               `json:"interval"`
	Value      float64           `json:"value"`
	Unit       string            `json:"unit"`
	Time       int64             `json:"time"`
	TargetType string            `json:"target_type"`
	Tags       map[string]string `json:"tags"`
}

// returns a id (hash key) in the format OrgId.md5Sum
// the md5sum is a hash of the the concatination of the
// series name + each tag key:value pair, sorted alphabetically.
func (m *MetricData) Id() string {
	var buffer bytes.Buffer
	buffer.WriteString(m.Name)
	keys := make([]string, 0)
	for k, _ := range m.Tags {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		buffer.WriteString(fmt.Sprintf(":%s=%s", k, m.Tags[k]))
	}

	return fmt.Sprintf("%d.%x", m.OrgId, md5.Sum(buffer.Bytes()))
}

// for ES: Id         string            `json:"id"`

// can be used by some encoders, such as msgp
type MetricDataArray []*MetricData

// for ES
type MetricDefinition struct {
	Id         string            `json:"id"`
	OrgId      int               `json:"org_id"`
	Name       string            `json:"name" elastic:"type:string,index:not_analyzed"`
	Metric     string            `json:"metric"`
	Interval   int               `json:"interval"` // minimum 10
	Unit       string            `json:"unit"`
	TargetType string            `json:"target_type"` // an emum ["derive","gauge"] in nodejs
	Tags       map[string]string `json:"tags"`
	LastUpdate int64             `json:"lastUpdate"` // unix epoch time, per the nodejs definition
}

func (m *MetricDefinition) Validate() error {
	if m.Name == "" || m.OrgId == 0 || (m.TargetType != "derive" && m.TargetType != "gauge") || m.Interval == 0 || m.Metric == "" || m.Unit == "" {
		// TODO: this error message ought to be more informative
		err := fmt.Errorf("metric is not valid!")
		return err
	}
	return nil
}

func MetricDefinitionFromJSON(b []byte) (*MetricDefinition, error) {
	def := new(MetricDefinition)
	if err := json.Unmarshal(b, &def); err != nil {
		return nil, err
	}
	def.Id = fmt.Sprintf("%d.%s", def.OrgId, def.Name)
	return def, nil
}

func MetricDefinitionFromMetricData(id string, d *MetricData) *MetricDefinition {
	return &MetricDefinition{
		Id:         id,
		Name:       d.Name,
		OrgId:      d.OrgId,
		Metric:     d.Metric,
		TargetType: d.TargetType,
		Interval:   d.Interval,
		LastUpdate: time.Now().Unix(),
		Unit:       d.Unit,
		Tags:       d.Tags,
	}
}
