package pipeline

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/sdk/resource"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/services/live/model"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	service     = "grafana"
	environment = "dev"
	id          = 1
)

// tracerProvider returns an OpenTelemetry TracerProvider configured to use
// the Jaeger exporter that will send spans to the provided url. The returned
// TracerProvider will also use a Resource configured with all the information
// about the application.
func tracerProvider(url string) (*tracesdk.TracerProvider, error) {
	// Create the Jaeger exporter
	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(url)))
	if err != nil {
		return nil, err
	}
	tp := tracesdk.NewTracerProvider(
		// Always be sure to batch in production.
		tracesdk.WithBatcher(exp),
		// Record information about this application in an Resource.
		tracesdk.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceNameKey.String(service),
			attribute.String("environment", environment),
			attribute.Int64("ID", id),
		)),
	)
	return tp, nil
}

// ChannelData is a wrapper over raw data with additional channel information.
// Channel is used for rule routing, if the channel is empty then data processing
// stops. If channel is not empty then data processing will be redirected to a
// corresponding channel rule.
type ChannelData struct {
	Channel string
	Data    []byte
}

// ChannelFrame is a wrapper over data.Frame with additional channel information.
// Channel is used for rule routing, if the channel is empty then frame processing
// will try to take current rule FrameProcessor and FrameOutputter. If channel is not empty
// then frame processing will be redirected to a corresponding channel rule.
type ChannelFrame struct {
	Channel string      `json:"channel"`
	Frame   *data.Frame `json:"frame"`
}

// Vars has some helpful things pipeline entities could use.
type Vars struct {
	OrgID     int64
	Channel   string
	Scope     string
	Namespace string
	Path      string
}

// DataOutputter can output incoming data before conversion to frames.
type DataOutputter interface {
	Type() string
	OutputData(ctx context.Context, vars Vars, data []byte) ([]*ChannelData, error)
}

// Converter converts raw bytes to slice of ChannelFrame. Each element
// of resulting slice will be then individually processed and outputted
// according configured channel rules.
type Converter interface {
	Type() string
	Convert(ctx context.Context, vars Vars, body []byte) ([]*ChannelFrame, error)
}

// FrameProcessor can modify data.Frame in a custom way before it will be outputted.
type FrameProcessor interface {
	Type() string
	ProcessFrame(ctx context.Context, vars Vars, frame *data.Frame) (*data.Frame, error)
}

// FrameOutputter outputs data.Frame to a custom destination. Or simply
// do nothing if some conditions not met.
type FrameOutputter interface {
	Type() string
	OutputFrame(ctx context.Context, vars Vars, frame *data.Frame) ([]*ChannelFrame, error)
}

// Subscriber can handle channel subscribe events.
type Subscriber interface {
	Type() string
	Subscribe(ctx context.Context, vars Vars, data []byte) (model.SubscribeReply, backend.SubscribeStreamStatus, error)
}

// PublishAuthChecker checks whether current user can publish to a channel.
type PublishAuthChecker interface {
	CanPublish(ctx context.Context, u *user.SignedInUser) (bool, error)
}

// SubscribeAuthChecker checks whether current user can subscribe to a channel.
type SubscribeAuthChecker interface {
	CanSubscribe(ctx context.Context, u *user.SignedInUser) (bool, error)
}

// LiveChannelRule is an in-memory representation of each specific rule to be executed by Pipeline.
type LiveChannelRule struct {
	// OrgId this rule belongs to.
	OrgId int64
	// Pattern is a pattern for a channel which when matched results in the rule execution
	// during Subscribe or Publish operations. This is very similar to HTTP router functionality but
	// adapted for Grafana Live channels.
	// We use a modified version of github.com/julienschmidt/httprouter for pattern matching logic
	// (see tree package's README for more information).
	Pattern string

	// SubscribeAuth allows providing authorization logic for subscribing to a channel.
	// If SubscribeAuth is not set then all authenticated users can subscribe to a channel.
	SubscribeAuth SubscribeAuthChecker
	// Subscribers allow modifying subscription properties and optionally call additional logic
	// like opening a single stream to a plugin to consume channel events. If not set then
	// subscription will have all options disabled, no initial data.
	Subscribers []Subscriber

	// PublishAuth allows providing authorization logic for publishing into a channel.
	// If PublishAuth is not set then RoleAdmin is required to publish.
	PublishAuth PublishAuthChecker
	// DataOutputters if set allows doing something useful with raw input data. If not set then
	// we step further to the converter. Each DataOutputter can optionally return a slice
	// of ChannelData to pass the control to a rule defined by ChannelData.Channel - i.e.
	// DataOutputters for the returned ChannelData.Channel will be executed. Note that in
	// this case input processing will skip PublishAuth of ChannelData.Channel. I.e. authorization
	// rules defined by the first channel in a pipeline chain.
	DataOutputters []DataOutputter
	// Converter allows transforming raw input data to frames. The Converter can split raw data to
	// slice of ChannelFrame. Each ChannelFrame is then processed according to ChannelFrame.Channel
	// rules - i.e. FrameProcessors for the returned ChannelFrame.Channel will be executed.
	// If ChannelFrame.Channel is empty then we proceed with the current rule towards
	// applying its FrameProcessors.
	Converter Converter
	// FrameProcessors can have logic to modify data.Frame before applying FrameOutputters.
	FrameProcessors []FrameProcessor
	// FrameOutputters if set allow doing something useful with data.Frame. Each FrameOutputter
	// can optionally return a slice of ChannelFrame to pass the control to a rule defined
	// by ChannelFrame.Channel.
	FrameOutputters []FrameOutputter
}

// Label ...
type Label struct {
	Name  string `json:"name"`
	Value string `json:"value"` // Can be JSONPath or Goja script.
}

type ChannelRuleGetter interface {
	Get(orgID int64, channel string) (*LiveChannelRule, bool, error)
}

// Pipeline allows processing custom input data according to user-defined rules.
// This includes:
// * transforming custom input to data.Frame objects
// * do some processing on these frames
// * output resulting frames to various destinations.
type Pipeline struct {
	ruleGetter ChannelRuleGetter
	tracer     trace.Tracer
}

// New creates new Pipeline.
func New(ruleGetter ChannelRuleGetter) (*Pipeline, error) {
	p := &Pipeline{
		ruleGetter: ruleGetter,
	}

	if os.Getenv("GF_LIVE_PIPELINE_TRACE") != "" {
		// Traces for development only at the moment.
		// Start local Jaeger and then run Grafana with GF_LIVE_PIPELINE_TRACE:
		// docker run --rm -it --name jaeger -e COLLECTOR_ZIPKIN_HOST_PORT=:9411 -p 5775:5775/udp -p 6831:6831/udp -p 6832:6832/udp -p 5778:5778 -p 16686:16686 -p 14268:14268 -p 14250:14250 -p 9411:9411 jaegertracing/all-in-one:1.26
		// Then visit http://localhost:16686/ where Jaeger UI is served.
		tp, err := tracerProvider("http://localhost:14268/api/traces")
		if err != nil {
			return nil, err
		}
		tracer := tp.Tracer("gf.live.pipeline")
		p.tracer = tracer
	}

	if os.Getenv("GF_LIVE_PIPELINE_DEV") != "" {
		go postTestData() // TODO: temporary for development, remove before merge.
	}

	return p, nil
}

func (p *Pipeline) Get(orgID int64, channel string) (*LiveChannelRule, bool, error) {
	return p.ruleGetter.Get(orgID, channel)
}

func (p *Pipeline) ProcessInput(ctx context.Context, orgID int64, channelID string, body []byte) (bool, error) {
	var span trace.Span
	if p.tracer != nil {
		ctx, span = p.tracer.Start(ctx, "live.pipeline.process_input")
		span.SetAttributes(
			attribute.Int64("orgId", orgID),
			attribute.String("channel", channelID),
			attribute.String("body", string(body)),
		)
		defer span.End()
	}
	ok, err := p.processInput(ctx, orgID, channelID, body, nil)
	if err != nil {
		if p.tracer != nil && span != nil {
			span.SetStatus(codes.Error, err.Error())
		}
		return ok, err
	}
	return ok, err
}

func (p *Pipeline) processInput(ctx context.Context, orgID int64, channelID string, body []byte, visitedChannels map[string]struct{}) (bool, error) {
	var span trace.Span
	if p.tracer != nil {
		ctx, span = p.tracer.Start(ctx, "live.pipeline.process_input_"+channelID)
		span.SetAttributes(
			attribute.Int64("orgId", orgID),
			attribute.String("channel", channelID),
			attribute.String("body", string(body)),
		)
		defer span.End()
	}
	rule, ok, err := p.ruleGetter.Get(orgID, channelID)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, nil
	}
	if visitedChannels == nil {
		visitedChannels = map[string]struct{}{}
	}
	if len(rule.DataOutputters) > 0 {
		channelDataList := []*ChannelData{{Channel: channelID, Data: body}}
		err = p.processChannelDataList(ctx, orgID, channelID, channelDataList, visitedChannels)
		if err != nil {
			return false, err
		}
	}
	if rule.Converter == nil {
		return false, nil
	}
	channelFrames, err := p.DataToChannelFrames(ctx, *rule, orgID, channelID, body)
	if err != nil {
		return false, err
	}
	err = p.processChannelFrames(ctx, orgID, channelID, channelFrames, nil)
	if err != nil {
		return false, fmt.Errorf("error processing frame: %w", err)
	}
	return true, nil
}

func (p *Pipeline) DataToChannelFrames(ctx context.Context, rule LiveChannelRule, orgID int64, channelID string, body []byte) ([]*ChannelFrame, error) {
	var span trace.Span
	if p.tracer != nil {
		ctx, span = p.tracer.Start(ctx, "live.pipeline.convert_"+rule.Converter.Type())
		span.SetAttributes(
			attribute.Int64("orgId", orgID),
			attribute.String("channel", channelID),
		)
		defer span.End()
	}

	channel, err := live.ParseChannel(channelID)
	if err != nil {
		logger.Error("Error parsing channel", "error", err, "channel", channelID)
		return nil, err
	}

	vars := Vars{
		OrgID:     orgID,
		Channel:   channelID,
		Scope:     channel.Scope,
		Namespace: channel.Namespace,
		Path:      channel.Path,
	}

	frames, err := rule.Converter.Convert(ctx, vars, body)
	if err != nil {
		logger.Error("Error converting data", "error", err)
		return nil, err
	}

	return frames, nil
}

var errChannelRecursion = errors.New("channel recursion")

func (p *Pipeline) processChannelDataList(ctx context.Context, orgID int64, channelID string, channelDataList []*ChannelData, visitedChannels map[string]struct{}) error {
	for _, channelData := range channelDataList {
		var nextChannel = channelID
		if channelData.Channel != "" {
			nextChannel = channelData.Channel
		}
		if _, ok := visitedChannels[nextChannel]; ok {
			return fmt.Errorf("%w: %s", errChannelRecursion, nextChannel)
		}
		visitedChannels[nextChannel] = struct{}{}
		newChannelDataList, err := p.processData(ctx, orgID, nextChannel, channelData.Data)
		if err != nil {
			return err
		}
		if len(newChannelDataList) > 0 {
			for _, cd := range newChannelDataList {
				_, err := p.processInput(ctx, orgID, cd.Channel, cd.Data, visitedChannels)
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (p *Pipeline) processChannelFrames(ctx context.Context, orgID int64, channelID string, channelFrames []*ChannelFrame, visitedChannels map[string]struct{}) error {
	if visitedChannels == nil {
		visitedChannels = map[string]struct{}{}
	}
	for _, channelFrame := range channelFrames {
		var processorChannel = channelID
		if channelFrame.Channel != "" {
			processorChannel = channelFrame.Channel
		}
		if _, ok := visitedChannels[processorChannel]; ok {
			return fmt.Errorf("%w: %s", errChannelRecursion, processorChannel)
		}
		visitedChannels[processorChannel] = struct{}{}
		frames, err := p.processFrame(ctx, orgID, processorChannel, channelFrame.Frame)
		if err != nil {
			return err
		}
		if len(frames) > 0 {
			err := p.processChannelFrames(ctx, orgID, processorChannel, frames, visitedChannels)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (p *Pipeline) processFrame(ctx context.Context, orgID int64, channelID string, frame *data.Frame) ([]*ChannelFrame, error) {
	var span trace.Span
	if p.tracer != nil {
		table, err := frame.StringTable(32, 32)
		if err != nil {
			return nil, err
		}
		ctx, span = p.tracer.Start(ctx, "live.pipeline.process_frame_"+channelID)
		span.SetAttributes(
			attribute.Int64("orgId", orgID),
			attribute.String("channel", channelID),
			attribute.String("frame", table),
		)
		defer span.End()
	}
	rule, ruleOk, err := p.ruleGetter.Get(orgID, channelID)
	if err != nil {
		logger.Error("Error getting rule", "error", err)
		return nil, err
	}
	if !ruleOk {
		logger.Debug("Rule not found", "channel", channelID)
		return nil, err
	}

	ch, err := live.ParseChannel(channelID)
	if err != nil {
		logger.Error("Error parsing channel", "error", err, "channel", channelID)
		return nil, err
	}

	vars := Vars{
		OrgID:     orgID,
		Channel:   channelID,
		Scope:     ch.Scope,
		Namespace: ch.Namespace,
		Path:      ch.Path,
	}

	if len(rule.FrameProcessors) > 0 {
		for _, proc := range rule.FrameProcessors {
			frame, err = p.execProcessor(ctx, proc, vars, frame)
			if err != nil {
				logger.Error("Error processing frame", "error", err)
				return nil, err
			}
			if frame == nil {
				return nil, nil
			}
		}
	}

	if len(rule.FrameOutputters) > 0 {
		var resultingFrames []*ChannelFrame
		for _, out := range rule.FrameOutputters {
			frames, err := p.processFrameOutput(ctx, out, vars, frame)
			if err != nil {
				logger.Error("Error outputting frame", "error", err)
				return nil, err
			}
			resultingFrames = append(resultingFrames, frames...)
		}
		return resultingFrames, nil
	}

	return nil, nil
}

func (p *Pipeline) execProcessor(ctx context.Context, proc FrameProcessor, vars Vars, frame *data.Frame) (*data.Frame, error) {
	var span trace.Span
	if p.tracer != nil {
		ctx, span = p.tracer.Start(ctx, "live.pipeline.apply_processor_"+proc.Type())
		table, err := frame.StringTable(32, 32)
		if err != nil {
			return nil, err
		}
		span.SetAttributes(
			attribute.Int64("orgId", vars.OrgID),
			attribute.String("channel", vars.Channel),
			attribute.String("frame", table),
			attribute.String("processor", proc.Type()),
		)
		// Note: we can also visualize resulting frame here.
		defer span.End()
	}
	return proc.ProcessFrame(ctx, vars, frame)
}

func (p *Pipeline) processFrameOutput(ctx context.Context, out FrameOutputter, vars Vars, frame *data.Frame) ([]*ChannelFrame, error) {
	var span trace.Span
	if p.tracer != nil {
		ctx, span = p.tracer.Start(ctx, "live.pipeline.frame_output_"+out.Type())
		table, err := frame.StringTable(32, 32)
		if err != nil {
			return nil, err
		}
		span.SetAttributes(
			attribute.Int64("orgId", vars.OrgID),
			attribute.String("channel", vars.Channel),
			attribute.String("frame", table),
			attribute.String("output", out.Type()),
		)
		defer span.End()
	}
	return out.OutputFrame(ctx, vars, frame)
}

func (p *Pipeline) processData(ctx context.Context, orgID int64, channelID string, data []byte) ([]*ChannelData, error) {
	var span trace.Span
	if p.tracer != nil {
		ctx, span = p.tracer.Start(ctx, "live.pipeline.process_data_"+channelID)
		span.SetAttributes(
			attribute.Int64("orgId", orgID),
			attribute.String("channel", channelID),
			attribute.String("data", string(data)),
		)
		defer span.End()
	}
	rule, ruleOk, err := p.ruleGetter.Get(orgID, channelID)
	if err != nil {
		logger.Error("Error getting rule", "error", err)
		return nil, err
	}
	if !ruleOk {
		logger.Debug("Rule not found", "channel", channelID)
		return nil, err
	}

	ch, err := live.ParseChannel(channelID)
	if err != nil {
		logger.Error("Error parsing channel", "error", err, "channel", channelID)
		return nil, err
	}

	vars := Vars{
		OrgID:     orgID,
		Channel:   channelID,
		Scope:     ch.Scope,
		Namespace: ch.Namespace,
		Path:      ch.Path,
	}

	if len(rule.DataOutputters) > 0 {
		var resultingChannelDataList []*ChannelData
		for _, out := range rule.DataOutputters {
			channelDataList, err := p.processDataOutput(ctx, out, vars, data)
			if err != nil {
				logger.Error("Error outputting frame", "error", err)
				return nil, err
			}
			resultingChannelDataList = append(resultingChannelDataList, channelDataList...)
		}
		return resultingChannelDataList, nil
	}

	return nil, nil
}

func (p *Pipeline) processDataOutput(ctx context.Context, out DataOutputter, vars Vars, data []byte) ([]*ChannelData, error) {
	var span trace.Span
	if p.tracer != nil {
		ctx, span = p.tracer.Start(ctx, "live.pipeline.data_output_"+out.Type())
		span.SetAttributes(
			attribute.Int64("orgId", vars.OrgID),
			attribute.String("channel", vars.Channel),
			attribute.String("data", string(data)),
			attribute.String("output", out.Type()),
		)
		defer span.End()
	}
	return out.OutputData(ctx, vars, data)
}
