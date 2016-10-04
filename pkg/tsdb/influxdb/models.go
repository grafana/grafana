package influxdb

import "github.com/grafana/grafana/pkg/components/simplejson"

type InfluxDBQuery struct {
	Measurement  string
	Policy       string
	ResultFormat string
	Tags         []Tag
	GroupBy      []GroupBy
}

type Tag struct {
	Key      string
	Operator string
	Value    string
}

type GroupBy struct {
	Type   string
	Params []string
}

type InfluxDbSelect struct {
	Type string
}

func ParseQuery(model *simplejson.Json) (*InfluxDBQuery, error) {
	measurement, err := model.Get("measurement").String()
	if err != nil {
		return nil, err
	}

	policy := model.Get("policy").MustString("default")

	resultFormat, err := model.Get("resultFormat").String()
	if err != nil {
		return nil, err
	}

	var tags []Tag
	var groupBy []GroupBy

	for _, g := range model.Get("groupBy").MustArray() {
		group := simplejson.NewFromAny(g)

		typ, err := group.Get("type").String()
		if err != nil {
			return nil, err
		}

		var params []string
		for _, p := range group.Get("params").MustArray() {
			param := simplejson.NewFromAny(p)

			pv, err := param.String()
			if err != nil {
				return nil, err
			}
			params = append(params, pv)
		}

		gap := GroupBy{
			Type:   typ,
			Params: params,
		}

		groupBy = append(groupBy, gap)
	}

	for _, t := range model.Get("tags").MustArray() {
		tag := simplejson.NewFromAny(t)

		key, err := tag.Get("key").String()
		if err != nil {
			return nil, err
		}

		operator, err := tag.Get("operator").String()
		if err != nil {
			return nil, err
		}

		value, err := tag.Get("value").String()
		if err != nil {
			return nil, err
		}

		tags = append(tags, Tag{Key: key, Operator: operator, Value: value})
	}

	return &InfluxDBQuery{
		Measurement:  measurement,
		Policy:       policy,
		ResultFormat: resultFormat,
		GroupBy:      groupBy,
		Tags:         tags,
	}, nil
}
