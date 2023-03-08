package parca

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	v1alpha1 "buf.build/gen/go/parca-dev/parca/protocolbuffers/go/parca/query/v1alpha1"
	"github.com/bufbuild/connect-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type ProfileType struct {
	// Same as *v1alpha1.ProfileType just added the ID
	Name       string `json:"name,omitempty"`
	SampleType string `json:"sample_type,omitempty"`
	SampleUnit string `json:"sample_unit,omitempty"`
	PeriodType string `json:"period_type,omitempty"`
	PeriodUnit string `json:"period_unit,omitempty"`
	Delta      bool   `json:"delta,omitempty"`
	ID         string `json:"ID,omitempty"`
}

func (d *ParcaDatasource) callProfileTypes(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	res, err := d.client.ProfileTypes(ctx, connect.NewRequest(&v1alpha1.ProfileTypesRequest{}))
	if err != nil {
		return err
	}

	types := make([]*ProfileType, 0, len(res.Msg.Types))
	for _, t := range res.Msg.Types {
		var id string
		if t.Delta {
			id = fmt.Sprintf("%s:%s:%s:%s:%s:delta", t.Name, t.SampleType, t.SampleUnit, t.PeriodType, t.PeriodUnit)
		} else {
			id = fmt.Sprintf("%s:%s:%s:%s:%s", t.Name, t.SampleType, t.SampleUnit, t.PeriodType, t.PeriodUnit)
		}

		types = append(types, &ProfileType{
			Name:       t.Name,
			SampleType: t.SampleType,
			SampleUnit: t.SampleUnit,
			PeriodType: t.PeriodType,
			PeriodUnit: t.PeriodUnit,
			Delta:      t.Delta,
			ID:         id,
		})
	}

	data, err := json.Marshal(types)
	if err != nil {
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
		return err
	}
	return nil
}

func (d *ParcaDatasource) callLabelNames(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	res, err := d.client.Labels(ctx, connect.NewRequest(&v1alpha1.LabelsRequest{}))
	if err != nil {
		return err
	}

	data, err := json.Marshal(res.Msg.LabelNames)
	if err != nil {
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
		return err
	}
	return nil
}

func (d *ParcaDatasource) callLabelValues(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	parsedUrl, err := url.Parse(req.URL)
	if err != nil {
		return err
	}
	label, ok := parsedUrl.Query()["label"]
	if !ok {
		label = []string{""}
	}
	res, err := d.client.Values(ctx, connect.NewRequest(&v1alpha1.ValuesRequest{LabelName: label[0]}))
	if err != nil {
		return err
	}
	data, err := json.Marshal(res.Msg.LabelValues)
	if err != nil {
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
		return err
	}
	return nil
}
