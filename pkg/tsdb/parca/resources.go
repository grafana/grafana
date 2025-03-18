package parca

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	v1alpha1 "buf.build/gen/go/parca-dev/parca/protocolbuffers/go/parca/query/v1alpha1"
	"connectrpc.com/connect"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"go.opentelemetry.io/otel/codes"
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
	ctxLogger := logger.FromContext(ctx)
	ctxLogger.Debug("Getting profile types", "function", logEntrypoint())

	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.parca.callProfileTypes")
	defer span.End()
	res, err := d.client.ProfileTypes(ctx, connect.NewRequest(&v1alpha1.ProfileTypesRequest{}))
	if err != nil {
		ctxLogger.Error("Failed to get profile types", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
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
		ctxLogger.Error("Failed to marshal profile types", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
		ctxLogger.Error("Failed to send data to Parca", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	ctxLogger.Debug("Successfully got profile types", "function", logEntrypoint())
	return nil
}

func (d *ParcaDatasource) callLabelNames(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctxLogger := logger.FromContext(ctx)
	ctxLogger.Debug("Getting label names", "function", logEntrypoint())

	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.parca.callLabelNames")
	defer span.End()
	res, err := d.client.Labels(ctx, connect.NewRequest(&v1alpha1.LabelsRequest{}))
	if err != nil {
		ctxLogger.Error("Failed to get label names", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	data, err := json.Marshal(res.Msg.LabelNames)
	if err != nil {
		ctxLogger.Error("Failed to marshal label names", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
		ctxLogger.Error("Failed to send data to Parca", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	ctxLogger.Debug("Successfully got label names", "function", logEntrypoint())
	return nil
}

func (d *ParcaDatasource) callLabelValues(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctxLogger := logger.FromContext(ctx)
	ctxLogger.Debug("Getting label values", "function", logEntrypoint())

	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.parca.callLabelValues")
	defer span.End()
	parsedUrl, err := url.Parse(req.URL)
	if err != nil {
		ctxLogger.Error("Failed to parse URL", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	label, ok := parsedUrl.Query()["label"]
	if !ok {
		ctxLogger.Error("Failed to get label from query", "error", err, "function", logEntrypoint())
		label = []string{""}
	}
	res, err := d.client.Values(ctx, connect.NewRequest(&v1alpha1.ValuesRequest{LabelName: label[0]}))
	if err != nil {
		ctxLogger.Error("Failed to get values for given label", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	data, err := json.Marshal(res.Msg.LabelValues)
	if err != nil {
		ctxLogger.Error("Failed to marshal label values", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
		ctxLogger.Error("Failed to send data to Parca", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	ctxLogger.Debug("Successfully got label values", "function", logEntrypoint())
	return nil
}
