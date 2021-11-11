package tracing

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/jaegertracing/jaeger/thrift-gen/sampling"
	"github.com/uber/jaeger-client-go/log"
	"github.com/uber/jaeger-lib/metrics"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
)

const (
	defaultRemoteSamplingTimeout   = 10 * time.Second
	defaultSamplingRefreshInterval = time.Minute
	DefaultSamplingServerPort      = 5778
)

var (
	DefaultSamplingServerURL = fmt.Sprintf("http://127.0.0.1:%d/sampling", DefaultSamplingServerPort)
)

// SamplingStrategyFetcher is used to fetch sampling strategy updates from remote server.
type SamplingStrategyFetcher interface {
	Fetch(service string) ([]byte, error)
}

// SamplingStrategyParser is used to parse sampling strategy updates. The output object
// should be of the type that is recognized by the SamplerUpdaters.
type SamplingStrategyParser interface {
	Parse(response []byte) (interface{}, error)
}

type RemotelyControlledSampler struct {
	// These fields must be first in the struct because `sync/atomic` expects 64-bit alignment.
	// Cf. https://github.com/uber/jaeger-client-go/issues/155, https://goo.gl/zW7dgq
	closed int64 // 0 - not closed, 1 - closed

	sync.RWMutex // used to serialize access to samplerOptions.sampler
	samplerOptions

	serviceName string
	doneChan    chan *sync.WaitGroup
}

type samplerOptions struct {
	metrics                 *Metrics
	sampler                 SamplerV2
	logger                  log.DebugLogger
	samplingServerURL       string
	samplingRefreshInterval time.Duration
	samplingFetcher         SamplingStrategyFetcher
	samplingParser          SamplingStrategyParser
	updaters                []SamplerUpdater
	posParams               PerOperationSamplerParams
}

type SamplerUpdater interface {
	Update(sampler SamplerV2, strategy interface{}) (modified SamplerV2, err error)
}

// SamplerOption is a function that sets some option on the sampler
type SamplerOption func(options *samplerOptions)

// NewMetrics creates a new Metrics struct and initializes it.
func NewMetrics(factory metrics.Factory, globalTags map[string]string) *Metrics {
	m := &Metrics{}
	// TODO the namespace "jaeger" should be configurable
	metrics.MustInit(m, factory.Namespace(metrics.NSOptions{Name: "jaeger"}).Namespace(metrics.NSOptions{Name: "tracer"}), globalTags)
	return m
}

// NewNullMetrics creates a new Metrics struct that won't report any metrics.
func NewNullMetrics() *Metrics {
	return NewMetrics(metrics.NullFactory, nil)
}

func (o *samplerOptions) applyOptionsAndDefaults(opts ...SamplerOption) *samplerOptions {
	for _, option := range opts {
		option(o)
	}
	if o.sampler == nil {
		o.sampler = newProbabilisticSampler(0.001)
	}
	if o.logger == nil {
		o.logger = log.NullLogger
	}
	if o.samplingServerURL == "" {
		o.samplingServerURL = DefaultSamplingServerURL
	}
	if o.metrics == nil {
		o.metrics = NewNullMetrics()
	}
	if o.samplingRefreshInterval <= 0 {
		o.samplingRefreshInterval = defaultSamplingRefreshInterval
	}
	if o.samplingFetcher == nil {
		o.samplingFetcher = newHTTPSamplingStrategyFetcher(o.samplingServerURL, o.logger)
	}
	if o.samplingParser == nil {
		o.samplingParser = new(samplingStrategyParser)
	}
	if o.updaters == nil {
		o.updaters = []SamplerUpdater{
			&AdaptiveSamplerUpdater{
				MaxOperations:            o.posParams.MaxOperations,
				OperationNameLateBinding: o.posParams.OperationNameLateBinding,
			},
			new(ProbabilisticSamplerUpdater),
			new(RateLimitingSamplerUpdater),
		}
	}
	return o
}

func (s *RemotelyControlledSampler) ShouldSample(p tracesdk.SamplingParameters) tracesdk.SamplingResult {
	return tracesdk.SamplingResult{}
}

func (s *RemotelyControlledSampler) Description() string {
	return ""
}

// NewRemotelyControlledSampler creates a sampler that periodically pulls
// the sampling strategy from an HTTP sampling server (e.g. jaeger-agent).
func NewRemotelyControlledSampler(
	serviceName string,
	opts ...SamplerOption,
) *RemotelyControlledSampler {
	options := new(samplerOptions).applyOptionsAndDefaults(opts...)
	sampler := &RemotelyControlledSampler{
		samplerOptions: *options,
		serviceName:    serviceName,
		doneChan:       make(chan *sync.WaitGroup),
	}
	go sampler.pollController()
	return sampler
}

// SamplerOptions is a factory for all available SamplerOption's.
var SamplerOptions SamplerOptionsFactory

type SamplerOptionsFactory struct{}

// InitialSampler creates a SamplerOption that sets the initial sampler
// to use before a remote sampler is created and used.
func (SamplerOptionsFactory) InitialSampler(sampler Sampler) SamplerOption {
	return func(o *samplerOptions) {
		o.sampler = samplerV1toV2(sampler)
	}
}

// samplerV1toV2 wraps legacy V1 sampler into an adapter that make it look like V2.
func samplerV1toV2(s Sampler) SamplerV2 {
	if s2, ok := s.(SamplerV2); ok {
		return s2
	}
	type legacySamplerV1toV2Adapter struct {
		legacySamplerV1Base
	}
	return &legacySamplerV1toV2Adapter{
		legacySamplerV1Base: legacySamplerV1Base{
			delegate: s.IsSampled,
		},
	}
}

// SamplingServerURL creates a SamplerOption that sets the sampling server url
// of the local agent that contains the sampling strategies.
func (SamplerOptionsFactory) SamplingServerURL(samplingServerURL string) SamplerOption {
	return func(o *samplerOptions) {
		o.samplingServerURL = samplingServerURL
	}
}

// // SamplingRefreshInterval creates a SamplerOption that sets how often the
// // sampler will poll local agent for the appropriate sampling strategy.
// func (SamplerOptionsFactory) SamplingRefreshInterval(samplingRefreshInterval time.Duration) SamplerOption {
// 	return func(o *samplerOptions) {
// 		o.samplingRefreshInterval = samplingRefreshInterval
// 	}
// }

// SamplingDecision is returned by the V2 samplers.
type SamplingDecision struct {
	Sample    bool
	Retryable bool
	Tags      []Tag
}

func (s *RemotelyControlledSampler) pollController() {
	ticker := time.NewTicker(s.samplingRefreshInterval)
	defer ticker.Stop()
	s.pollControllerWithTicker(ticker)
}

func (s *RemotelyControlledSampler) pollControllerWithTicker(ticker *time.Ticker) {
	for {
		select {
		case <-ticker.C:
			s.UpdateSampler()
		case wg := <-s.doneChan:
			wg.Done()
			return
		}
	}
}

// UpdateSampler forces the sampler to fetch sampling strategy from backend server.
// This function is called automatically on a timer, but can also be safely called manually, e.g. from tests.
func (s *RemotelyControlledSampler) UpdateSampler() {
	res, err := s.samplingFetcher.Fetch(s.serviceName)
	if err != nil {
		s.metrics.SamplerQueryFailure.Inc(1)
		s.logger.Infof("failed to fetch sampling strategy: %v", err)
		return
	}
	strategy, err := s.samplingParser.Parse(res)
	if err != nil {
		s.metrics.SamplerUpdateFailure.Inc(1)
		s.logger.Infof("failed to parse sampling strategy response: %v", err)
		return
	}

	s.Lock()
	defer s.Unlock()

	s.metrics.SamplerRetrieved.Inc(1)
	if err := s.updateSamplerViaUpdaters(strategy); err != nil {
		s.metrics.SamplerUpdateFailure.Inc(1)
		s.logger.Infof("failed to handle sampling strategy response %+v. Got error: %v", res, err)
		return
	}
	s.metrics.SamplerUpdated.Inc(1)
}

// NB: this function should only be called while holding a Write lock
func (s *RemotelyControlledSampler) updateSamplerViaUpdaters(strategy interface{}) error {
	for _, updater := range s.updaters {
		sampler, err := updater.Update(s.sampler, strategy)
		if err != nil {
			return err
		}
		if sampler != nil {
			s.logger.Debugf("sampler updated: %+v", sampler)
			s.sampler = sampler
			return nil
		}
	}
	return fmt.Errorf("unsupported sampling strategy %+v", strategy)
}

// ProbabilisticSamplerUpdater is used by RemotelyControlledSampler to parse sampling configuration.
type ProbabilisticSamplerUpdater struct{}

// Update implements Update of SamplerUpdater.
func (u *ProbabilisticSamplerUpdater) Update(sampler SamplerV2, strategy interface{}) (SamplerV2, error) {
	type response interface {
		GetProbabilisticSampling() *sampling.ProbabilisticSamplingStrategy
	}
	var _ response = new(sampling.SamplingStrategyResponse) // sanity signature check
	if resp, ok := strategy.(response); ok {
		if probabilistic := resp.GetProbabilisticSampling(); probabilistic != nil {
			if ps, ok := sampler.(*ProbabilisticSampler); ok {
				if err := ps.Update(probabilistic.SamplingRate); err != nil {
					return nil, err
				}
				return sampler, nil
			}
			return newProbabilisticSampler(probabilistic.SamplingRate), nil
		}
	}
	return nil, nil
}

// RateLimitingSamplerUpdater is used by RemotelyControlledSampler to parse sampling configuration.
type RateLimitingSamplerUpdater struct{}

// Update implements Update of SamplerUpdater.
func (u *RateLimitingSamplerUpdater) Update(sampler SamplerV2, strategy interface{}) (SamplerV2, error) {
	type response interface {
		GetRateLimitingSampling() *sampling.RateLimitingSamplingStrategy
	}
	var _ response = new(sampling.SamplingStrategyResponse) // sanity signature check
	if resp, ok := strategy.(response); ok {
		if rateLimiting := resp.GetRateLimitingSampling(); rateLimiting != nil {
			rateLimit := float64(rateLimiting.MaxTracesPerSecond)
			if rl, ok := sampler.(*RateLimitingSampler); ok {
				rl.Update(rateLimit)
				return rl, nil
			}
			return NewRateLimitingSampler(rateLimit), nil
		}
	}
	return nil, nil
}

// AdaptiveSamplerUpdater is used by RemotelyControlledSampler to parse sampling configuration.
// Fields have the same meaning as in PerOperationSamplerParams.
type AdaptiveSamplerUpdater struct {
	MaxOperations            int
	OperationNameLateBinding bool
}

// Span implements opentracing.Span
type Span struct {
	sync.RWMutex
	context       SpanContext
	operationName string
}

// Metrics is a container of all stats emitted by Jaeger tracer.
type Metrics struct {
	// Number of traces started by this tracer as sampled
	TracesStartedSampled metrics.Counter `metric:"traces" tags:"state=started,sampled=y" help:"Number of traces started by this tracer as sampled"`

	// Number of traces started by this tracer as not sampled
	TracesStartedNotSampled metrics.Counter `metric:"traces" tags:"state=started,sampled=n" help:"Number of traces started by this tracer as not sampled"`

	// Number of traces started by this tracer with delayed sampling
	TracesStartedDelayedSampling metrics.Counter `metric:"traces" tags:"state=started,sampled=n" help:"Number of traces started by this tracer with delayed sampling"`

	// Number of externally started sampled traces this tracer joined
	TracesJoinedSampled metrics.Counter `metric:"traces" tags:"state=joined,sampled=y" help:"Number of externally started sampled traces this tracer joined"`

	// Number of externally started not-sampled traces this tracer joined
	TracesJoinedNotSampled metrics.Counter `metric:"traces" tags:"state=joined,sampled=n" help:"Number of externally started not-sampled traces this tracer joined"`

	// Number of sampled spans started by this tracer
	SpansStartedSampled metrics.Counter `metric:"started_spans" tags:"sampled=y" help:"Number of spans started by this tracer as sampled"`

	// Number of not sampled spans started by this tracer
	SpansStartedNotSampled metrics.Counter `metric:"started_spans" tags:"sampled=n" help:"Number of spans started by this tracer as not sampled"`

	// Number of spans with delayed sampling started by this tracer
	SpansStartedDelayedSampling metrics.Counter `metric:"started_spans" tags:"sampled=delayed" help:"Number of spans started by this tracer with delayed sampling"`

	// Number of spans finished by this tracer
	SpansFinishedSampled metrics.Counter `metric:"finished_spans" tags:"sampled=y" help:"Number of sampled spans finished by this tracer"`

	// Number of spans finished by this tracer
	SpansFinishedNotSampled metrics.Counter `metric:"finished_spans" tags:"sampled=n" help:"Number of not-sampled spans finished by this tracer"`

	// Number of spans finished by this tracer
	SpansFinishedDelayedSampling metrics.Counter `metric:"finished_spans" tags:"sampled=delayed" help:"Number of spans with delayed sampling finished by this tracer"`

	// Number of errors decoding tracing context
	DecodingErrors metrics.Counter `metric:"span_context_decoding_errors" help:"Number of errors decoding tracing context"`

	// Number of spans successfully reported
	ReporterSuccess metrics.Counter `metric:"reporter_spans" tags:"result=ok" help:"Number of spans successfully reported"`

	// Number of spans not reported due to a Sender failure
	ReporterFailure metrics.Counter `metric:"reporter_spans" tags:"result=err" help:"Number of spans not reported due to a Sender failure"`

	// Number of spans dropped due to internal queue overflow
	ReporterDropped metrics.Counter `metric:"reporter_spans" tags:"result=dropped" help:"Number of spans dropped due to internal queue overflow"`

	// Current number of spans in the reporter queue
	ReporterQueueLength metrics.Gauge `metric:"reporter_queue_length" help:"Current number of spans in the reporter queue"`

	// Number of times the Sampler succeeded to retrieve sampling strategy
	SamplerRetrieved metrics.Counter `metric:"sampler_queries" tags:"result=ok" help:"Number of times the Sampler succeeded to retrieve sampling strategy"`

	// Number of times the Sampler failed to retrieve sampling strategy
	SamplerQueryFailure metrics.Counter `metric:"sampler_queries" tags:"result=err" help:"Number of times the Sampler failed to retrieve sampling strategy"`

	// Number of times the Sampler succeeded to retrieve and update sampling strategy
	SamplerUpdated metrics.Counter `metric:"sampler_updates" tags:"result=ok" help:"Number of times the Sampler succeeded to retrieve and update sampling strategy"`

	// Number of times the Sampler failed to update sampling strategy
	SamplerUpdateFailure metrics.Counter `metric:"sampler_updates" tags:"result=err" help:"Number of times the Sampler failed to update sampling strategy"`

	// Number of times baggage was successfully written or updated on spans.
	BaggageUpdateSuccess metrics.Counter `metric:"baggage_updates" tags:"result=ok" help:"Number of times baggage was successfully written or updated on spans"`

	// Number of times baggage failed to write or update on spans.
	BaggageUpdateFailure metrics.Counter `metric:"baggage_updates" tags:"result=err" help:"Number of times baggage failed to write or update on spans"`

	// Number of times baggage was truncated as per baggage restrictions.
	BaggageTruncate metrics.Counter `metric:"baggage_truncations" help:"Number of times baggage was truncated as per baggage restrictions"`

	// Number of times baggage restrictions were successfully updated.
	BaggageRestrictionsUpdateSuccess metrics.Counter `metric:"baggage_restrictions_updates" tags:"result=ok" help:"Number of times baggage restrictions were successfully updated"`

	// Number of times baggage restrictions failed to update.
	BaggageRestrictionsUpdateFailure metrics.Counter `metric:"baggage_restrictions_updates" tags:"result=err" help:"Number of times baggage restrictions failed to update"`

	// Number of times debug spans were throttled.
	ThrottledDebugSpans metrics.Counter `metric:"throttled_debug_spans" help:"Number of times debug spans were throttled"`

	// Number of times throttler successfully updated.
	ThrottlerUpdateSuccess metrics.Counter `metric:"throttler_updates" tags:"result=ok" help:"Number of times throttler successfully updated"`

	// Number of times throttler failed to update.
	ThrottlerUpdateFailure metrics.Counter `metric:"throttler_updates" tags:"result=err" help:"Number of times throttler failed to update"`
}

// SpanID represents unique 64bit identifier of a span
type SpanID uint64

// SpanContext represents propagated span identity and state
type SpanContext struct {
	traceID       TraceID
	spanID        SpanID
	samplingState *samplingState

	// // remote indicates that span context represents a remote parent
	// remote bool
}

type samplingState struct {
	localRootSpan SpanID
}

// SamplerV2 is an extension of the V1 samplers that allows sampling decisions
// be made at different points of the span lifecycle.
type SamplerV2 interface {
	OnCreateSpan(span *Span) SamplingDecision
	OnSetOperationName(span *Span, operationName string) SamplingDecision
	OnSetTag(span *Span, key string, value interface{}) SamplingDecision
	OnFinishSpan(span *Span) SamplingDecision
	Close()
}

func (s *legacySamplerV1Base) OnCreateSpan(span *Span) SamplingDecision {
	isSampled, tags := s.delegate(span.context.traceID, span.operationName)
	return SamplingDecision{Sample: isSampled, Retryable: false, Tags: tags}
}

func (s *legacySamplerV1Base) OnSetOperationName(span *Span, operationName string) SamplingDecision {
	isSampled, tags := s.delegate(span.context.traceID, span.operationName)
	return SamplingDecision{Sample: isSampled, Retryable: false, Tags: tags}
}

func (s *legacySamplerV1Base) OnSetTag(span *Span, key string, value interface{}) SamplingDecision {
	return SamplingDecision{Sample: false, Retryable: true}
}

func (s *legacySamplerV1Base) OnFinishSpan(span *Span) SamplingDecision {
	return SamplingDecision{Sample: false, Retryable: true}
}

func (s *legacySamplerV1Base) Close() {}

// Update implements Update of SamplerUpdater.
func (u *AdaptiveSamplerUpdater) Update(sampler SamplerV2, strategy interface{}) (SamplerV2, error) {
	var _ response = new(sampling.SamplingStrategyResponse) // sanity signature check
	if p, ok := strategy.(response); ok {
		if operations := p.GetOperationSampling(); operations != nil {
			if as, ok := sampler.(*PerOperationSampler); ok {
				as.update(operations)
				return as, nil
			}
			return NewPerOperationSampler(PerOperationSamplerParams{
				MaxOperations:            u.MaxOperations,
				OperationNameLateBinding: u.OperationNameLateBinding,
				Strategies:               operations,
			}), nil
		}
	}
	return nil, nil
}

type response interface {
	GetOperationSampling() *sampling.PerOperationSamplingStrategies
}

type httpSamplingStrategyFetcher struct {
	serverURL  string
	logger     log.DebugLogger
	httpClient http.Client
}

func newHTTPSamplingStrategyFetcher(serverURL string, logger log.DebugLogger) *httpSamplingStrategyFetcher {
	customTransport := http.DefaultTransport.(*http.Transport).Clone()
	customTransport.ResponseHeaderTimeout = defaultRemoteSamplingTimeout

	return &httpSamplingStrategyFetcher{
		serverURL: serverURL,
		logger:    logger,
		httpClient: http.Client{
			Transport: customTransport,
		},
	}
}

func (f *httpSamplingStrategyFetcher) Fetch(serviceName string) ([]byte, error) {
	v := url.Values{}
	v.Set("service", serviceName)
	uri := f.serverURL + "?" + v.Encode()

	resp, err := f.httpClient.Get(uri)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			f.logger.Error(fmt.Sprintf("failed to close HTTP response body: %+v", err))
		}
	}()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("StatusCode: %d, Body: %s", resp.StatusCode, body)
	}

	return body, nil
}

type samplingStrategyParser struct{}

func (p *samplingStrategyParser) Parse(response []byte) (interface{}, error) {
	strategy := new(sampling.SamplingStrategyResponse)
	if err := json.Unmarshal(response, strategy); err != nil {
		return nil, err
	}
	return strategy, nil
}

func (s *PerOperationSampler) update(strategies *sampling.PerOperationSamplingStrategies) {
	s.Lock()
	defer s.Unlock()
	newSamplers := map[string]*GuaranteedThroughputProbabilisticSampler{}
	for _, strategy := range strategies.PerOperationStrategies {
		operation := strategy.Operation
		samplingRate := strategy.ProbabilisticSampling.SamplingRate
		lowerBound := strategies.DefaultLowerBoundTracesPerSecond
		if sampler, ok := s.samplers[operation]; ok {
			sampler.update(lowerBound, samplingRate)
			newSamplers[operation] = sampler
		} else {
			sampler := newGuaranteedThroughputProbabilisticSampler(
				lowerBound,
				samplingRate,
			)
			newSamplers[operation] = sampler
		}
	}
	s.lowerBound = strategies.DefaultLowerBoundTracesPerSecond
	if s.defaultSampler.SamplingRate() != strategies.DefaultSamplingProbability {
		s.defaultSampler = newProbabilisticSampler(strategies.DefaultSamplingProbability)
	}
	s.samplers = newSamplers
}

// this function should only be called while holding a Write lock
func (s *GuaranteedThroughputProbabilisticSampler) update(lowerBound, samplingRate float64) {
	s.setProbabilisticSampler(samplingRate)
	if s.lowerBound != lowerBound {
		s.lowerBoundSampler.Update(lowerBound)
		s.lowerBound = lowerBound
	}
}

// Close implements Close() of Sampler.
func (s *GuaranteedThroughputProbabilisticSampler) Close() {
	s.probabilisticSampler.Close()
	s.lowerBoundSampler.Close()
}

// Equal implements Equal() of Sampler.
func (s *GuaranteedThroughputProbabilisticSampler) Equal(other Sampler) bool {
	// NB The Equal() function is expensive and will be removed. See PerOperationSampler.Equal() for
	// more information.
	return false
}

// IsSampled implements IsSampled() of Sampler.
func (s *GuaranteedThroughputProbabilisticSampler) IsSampled(id TraceID, operation string) (bool, []Tag) {
	if sampled, tags := s.probabilisticSampler.IsSampled(id, operation); sampled {
		s.lowerBoundSampler.IsSampled(id, operation)
		return true, tags
	}
	sampled, _ := s.lowerBoundSampler.IsSampled(id, operation)
	return sampled, s.tags
}

// Close invokes Close on all underlying samplers.
func (s *PerOperationSampler) Close() {
	s.Lock()
	defer s.Unlock()
	for _, sampler := range s.samplers {
		sampler.Close()
	}
	s.defaultSampler.Close()
}

// OnCreateSpan implements OnCreateSpan of SamplerV2.
func (s *PerOperationSampler) OnCreateSpan(span *Span) SamplingDecision {
	sampled, tags := s.trySampling(span, span.OperationName())
	return SamplingDecision{Sample: sampled, Retryable: s.operationNameLateBinding, Tags: tags}
}

func (s *Span) OperationName() string {
	s.RLock()
	defer s.RUnlock()
	return s.operationName
}

// OnSetOperationName implements OnSetOperationName of SamplerV2.
func (s *PerOperationSampler) OnSetOperationName(span *Span, operationName string) SamplingDecision {
	sampled, tags := s.trySampling(span, operationName)
	return SamplingDecision{Sample: sampled, Retryable: false, Tags: tags}
}

// OnSetTag implements OnSetTag of SamplerV2.
func (s *PerOperationSampler) OnSetTag(span *Span, key string, value interface{}) SamplingDecision {
	return SamplingDecision{Sample: false, Retryable: true}
}

// OnFinishSpan implements OnFinishSpan of SamplerV2.
func (s *PerOperationSampler) OnFinishSpan(span *Span) SamplingDecision {
	return SamplingDecision{Sample: false, Retryable: true}
}

func (s *PerOperationSampler) trySampling(span *Span, operationName string) (bool, []Tag) {
	samplerV1 := s.getSamplerForOperation(operationName)
	var sampled bool
	var tags []Tag
	if span.context.samplingState.isLocalRootSpan(span.context.spanID) {
		sampled, tags = samplerV1.IsSampled(span.context.traceID, operationName)
	}
	return sampled, tags
}

func (s *PerOperationSampler) getSamplerForOperation(operation string) Sampler {
	s.RLock()
	sampler, ok := s.samplers[operation]
	if ok {
		defer s.RUnlock()
		return sampler
	}
	s.RUnlock()
	s.Lock()
	defer s.Unlock()

	// Check if sampler has already been created
	sampler, ok = s.samplers[operation]
	if ok {
		return sampler
	}
	// Store only up to maxOperations of unique ops.
	if len(s.samplers) >= s.maxOperations {
		return s.defaultSampler
	}
	newSampler := newGuaranteedThroughputProbabilisticSampler(s.lowerBound, s.defaultSampler.SamplingRate())
	s.samplers[operation] = newSampler
	return newSampler
}

func (s *samplingState) isLocalRootSpan(id SpanID) bool {
	return id == s.localRootSpan
}
