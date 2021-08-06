package pushhttp

import (
	"context"
	"errors"
	"io"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/live/pipeline"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/convert"
	"github.com/grafana/grafana/pkg/services/live/pushurl"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("live.push_http")
)

func init() {
	registry.RegisterServiceWithPriority(&Gateway{}, registry.Low)
}

// Gateway receives data and translates it to Grafana Live publications.
type Gateway struct {
	Cfg         *setting.Cfg      `inject:""`
	GrafanaLive *live.GrafanaLive `inject:""`

	converter         *convert.Converter
	autoJsonConverter *autoJsonConverter
	jsonPathConverter *jsonPathConverter
	pipeline          *pipeline.Pipeline
	frameStorage      *FrameStorage
	ruleProcessor     *RuleProcessor
}

type dropFieldsProcessor struct {
	drop []string
}

func removeIndex(s []*data.Field, index int) []*data.Field {
	return append(s[:index], s[index+1:]...)
}

func newDropFieldsProcessor(drop ...string) *dropFieldsProcessor {
	return &dropFieldsProcessor{drop: drop}
}

func (d dropFieldsProcessor) Process(_ context.Context, _ pipeline.ProcessorVars, frame *data.Frame) (*data.Frame, error) {
	for _, f := range d.drop {
	inner:
		for i, field := range frame.Fields {
			if f == field.Name {
				frame.Fields = removeIndex(frame.Fields, i)
				continue inner
			}
		}
	}
	return frame, nil
}

type managedStreamOutput struct {
	GrafanaLive *live.GrafanaLive
}

func newManagedStreamOutput(gLive *live.GrafanaLive) *managedStreamOutput {
	return &managedStreamOutput{GrafanaLive: gLive}
}

func (l managedStreamOutput) Output(_ context.Context, vars pipeline.OutputVars, frame *data.Frame) error {
	stream, err := l.GrafanaLive.ManagedStreamRunner.GetOrCreateStream(vars.OrgID, vars.Namespace)
	if err != nil {
		logger.Error("Error getting stream", "error", err)
		return err
	}
	return stream.Push(vars.Path, frame)
}

type fakeStorage struct {
	gLive         *live.GrafanaLive
	frameStorage  *FrameStorage
	ruleProcessor *RuleProcessor
}

func (f fakeStorage) ListChannelRules(_ context.Context, _ pipeline.ListLiveChannelRuleCommand) ([]*pipeline.LiveChannelRule, error) {
	return []*pipeline.LiveChannelRule{
		{
			OrgId:   1,
			Pattern: "stream/test/auto",
			Mode:    "auto",
			Processors: []pipeline.Processor{
				newDropFieldsProcessor("value2"),
			},
			Outputs: []pipeline.Outputter{
				newManagedStreamOutput(f.gLive),
				pipeline.NewRemoteWriteOutput(pipeline.RemoteWriteConfig{
					Enabled:  true,
					Endpoint: "",
				}),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/test/tip",
			Mode:    "tip",
			Fields: []pipeline.Field{
				{
					Name: "value3",
					Type: data.FieldTypeNullableFloat64,
				},
				{
					Name: "value4",
					Type: data.FieldTypeNullableFloat64,
				},
			},
			Processors: []pipeline.Processor{
				newDropFieldsProcessor("value2"),
			},
			Outputs: []pipeline.Outputter{
				newManagedStreamOutput(f.gLive),
				pipeline.NewRemoteWriteOutput(pipeline.RemoteWriteConfig{
					Enabled:  true,
					Endpoint: "",
				}),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/test/exact",
			Mode:    "exact",
			Fields: []pipeline.Field{
				{
					Name:  "time",
					Type:  data.FieldTypeTime,
					Value: "#{now}",
				},
				{
					Name:  "value1",
					Type:  data.FieldTypeNullableFloat64,
					Value: "$.value1",
				},
				{
					Name:  "value3",
					Type:  data.FieldTypeNullableFloat64,
					Value: "$.value3",
					Labels: []pipeline.Label{
						{
							Name:  "host",
							Value: "$.host",
						},
					},
				},
				{
					Name:  "map.red",
					Type:  data.FieldTypeNullableFloat64,
					Value: "$.map.red",
					Labels: []pipeline.Label{
						{
							Name:  "host",
							Value: "$.host",
						},
					},
				},
				{
					Name:  "annotation",
					Type:  data.FieldTypeNullableString,
					Value: "$.annotation",
				},
			},
			Processors: []pipeline.Processor{
				newDropFieldsProcessor("value2"),
			},
			Outputs: []pipeline.Outputter{
				newManagedStreamOutput(f.gLive),
				pipeline.NewRemoteWriteOutput(pipeline.RemoteWriteConfig{
					Enabled:  true,
					Endpoint: "",
				}),
				NewLiveChangeLogOutput(f.frameStorage, f.ruleProcessor, LiveChangeLogOutputConfig{
					Fields:  []string{"value3"},
					Channel: "stream/test/exact/value3/changes",
				}),
				NewLiveChangeLogOutput(f.frameStorage, f.ruleProcessor, LiveChangeLogOutputConfig{
					Fields:  []string{"annotation"},
					Channel: "stream/test/exact/annotation/changes",
				}),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/test/exact/value3/changes",
			Mode:    "auto",
			Outputs: []pipeline.Outputter{
				newManagedStreamOutput(f.gLive),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/test/exact/annotation/changes",
			Mode:    "auto",
			Outputs: []pipeline.Outputter{
				newManagedStreamOutput(f.gLive),
			},
		},
	}, nil
}

// Init Gateway.
func (g *Gateway) Init() error {
	logger.Info("Live Push Gateway initialization")

	g.converter = convert.NewConverter()
	storage := &fakeStorage{gLive: g.GrafanaLive, frameStorage: NewFrameStorage()}
	g.ruleProcessor = NewRuleProcessor(pipeline.New(storage))
	storage.ruleProcessor = g.ruleProcessor
	return nil
}

// Run Gateway.
func (g *Gateway) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (g *Gateway) Handle(ctx *models.ReqContext) {
	streamID := ctx.Params(":streamId")

	stream, err := g.GrafanaLive.ManagedStreamRunner.GetOrCreateStream(ctx.SignedInUser.OrgId, streamID)
	if err != nil {
		logger.Error("Error getting stream", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	// TODO Grafana 8: decide which formats to use or keep all.
	urlValues := ctx.Req.URL.Query()
	frameFormat := pushurl.FrameFormatFromValues(urlValues)

	body, err := io.ReadAll(ctx.Req.Request.Body)
	if err != nil {
		logger.Error("Error reading body", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}
	logger.Debug("Live Push request",
		"protocol", "http",
		"streamId", streamID,
		"bodyLength", len(body),
		"frameFormat", frameFormat,
	)

	metricFrames, err := g.converter.Convert(body, frameFormat)
	if err != nil {
		logger.Error("Error converting metrics", "error", err, "frameFormat", frameFormat)
		if errors.Is(err, convert.ErrUnsupportedFrameFormat) {
			ctx.Resp.WriteHeader(http.StatusBadRequest)
		} else {
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
		}
		return
	}

	// TODO -- make sure all packets are combined together!
	// interval = "1s" vs flush_interval = "5s"

	for _, mf := range metricFrames {
		err := stream.Push(mf.Key(), mf.Frame())
		if err != nil {
			logger.Error("Error pushing frame", "error", err, "data", string(body))
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
			return
		}
	}
}

func (g *Gateway) HandlePath(ctx *models.ReqContext) {
	streamID := ctx.Params(":streamId")
	path := ctx.Params(":path")

	body, err := io.ReadAll(ctx.Req.Request.Body)
	if err != nil {
		logger.Error("Error reading body", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}
	logger.Debug("Live Push request",
		"protocol", "http",
		"streamId", streamID,
		"path", path,
		"bodyLength", len(body),
	)

	channel := "stream/" + streamID + "/" + path

	frame, err := g.ruleProcessor.DataToFrame(context.Background(), ctx.OrgId, channel, body)
	if err != nil {
		logger.Error("Error data to frame", "error", err, "body", string(body))
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	err = g.ruleProcessor.ProcessFrame(context.Background(), ctx.OrgId, channel, frame)
	if err != nil {
		logger.Error("Error processing frame", "error", err, "data", string(body))
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}
}
