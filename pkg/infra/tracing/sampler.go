package tracing

import (
	"encoding/binary"
	"fmt"
	"math"
	"sync"

	"github.com/jaegertracing/jaeger/thrift-gen/sampling"
	"github.com/uber/jaeger-client-go/utils"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

const (
	defaultMaxOperations = 2000
)

type Sampler interface {
	IsSampled(id TraceID, operation string) (sampled bool, tags []Tag)

	Close()

	Equal(other Sampler) bool
}

// TraceID represents unique 128bit identifier of a trace
type TraceID struct {
	High, Low uint64
}

type Tag struct {
	key   string
	value interface{}
}

const (
	// SamplerTypeTagKey reports which sampler was used on the root span.
	SamplerTypeTagKey = "sampler.type"
	// SamplerTypeRateLimiting is the type of sampler that samples
	// only up to a fixed number of traces per second.
	SamplerTypeRateLimiting = "ratelimiting"
	// SamplerParamTagKey reports the parameter of the sampler, like sampling probability.
	SamplerParamTagKey = "sampler.param"
)

// legacySamplerV1Base is used as a base for simple samplers that only implement
// the legacy isSampled() function that is not sensitive to its arguments.
type legacySamplerV1Base struct {
	delegate func(id TraceID, operation string) (sampled bool, tags []Tag)
}

type RateLimitingSampler struct {
	legacySamplerV1Base
	maxTracesPerSecond float64
	rateLimiter        *utils.ReconfigurableRateLimiter
	tags               []Tag
}

// NewRateLimitingSampler creates new RateLimitingSampler.
func NewRateLimitingSampler(maxTracesPerSecond float64) *RateLimitingSampler {
	s := new(RateLimitingSampler)
	s.delegate = s.IsSampled
	return s.init(maxTracesPerSecond)
}

func (s *RateLimitingSampler) init(maxTracesPerSecond float64) *RateLimitingSampler {
	if s.rateLimiter == nil {
		s.rateLimiter = utils.NewRateLimiter(maxTracesPerSecond, math.Max(maxTracesPerSecond, 1.0))
	} else {
		s.rateLimiter.Update(maxTracesPerSecond, math.Max(maxTracesPerSecond, 1.0))
	}
	s.maxTracesPerSecond = maxTracesPerSecond
	s.tags = []Tag{
		{key: SamplerTypeTagKey, value: SamplerTypeRateLimiting},
		{key: SamplerParamTagKey, value: maxTracesPerSecond},
	}
	return s
}

func (s *RateLimitingSampler) ShouldSample(p tracesdk.SamplingParameters) tracesdk.SamplingResult {
	psc := trace.SpanContextFromContext(p.ParentContext)
	traceID := TraceID{
		Low:  binary.BigEndian.Uint64(p.TraceID[0:8]),
		High: binary.BigEndian.Uint64(p.TraceID[8:16]),
	}
	sampled, _ := s.IsSampled(traceID, "ratelimiting")
	if !sampled {
		return tracesdk.SamplingResult{
			Decision:   tracesdk.Drop,
			Tracestate: psc.TraceState(),
		}
	}
	return tracesdk.SamplingResult{
		Decision:   tracesdk.RecordAndSample,
		Tracestate: psc.TraceState(),
	}
}

// IsSampled implements IsSampled() of Sampler.
func (s *RateLimitingSampler) IsSampled(id TraceID, operation string) (bool, []Tag) {
	return s.rateLimiter.CheckCredit(1.0), s.tags
}

func (s *RateLimitingSampler) Description() string {
	return ""
}

// Update reconfigures the rate limiter, while preserving its accumulated balance.
// Locking must be done externally.
func (s *RateLimitingSampler) Update(maxTracesPerSecond float64) {
	if s.maxTracesPerSecond != maxTracesPerSecond {
		s.init(maxTracesPerSecond)
	}
}

// Close does nothing.
func (s *RateLimitingSampler) Close() {
	// nothing to do
}

// // Equal compares with another sampler.
// func (s *RateLimitingSampler) Equal(other Sampler) bool {
// 	if o, ok := other.(*RateLimitingSampler); ok {
// 		return s.maxTracesPerSecond == o.maxTracesPerSecond
// 	}
// 	return false
// }

// String is used to log sampler details.
func (s *RateLimitingSampler) String() string {
	return fmt.Sprintf("RateLimitingSampler(maxTracesPerSecond=%v)", s.maxTracesPerSecond)
}

// PerOperationSamplerParams defines parameters when creating PerOperationSampler.
type PerOperationSamplerParams struct {
	// Max number of operations that will be tracked. Other operations will be given default strategy.
	MaxOperations int

	// Opt-in feature for applications that require late binding of span name via explicit call to SetOperationName.
	// When this feature is enabled, the sampler will return retryable=true from OnCreateSpan(), thus leaving
	// the sampling decision as non-final (and the span as writeable). This may lead to degraded performance
	// in applications that always provide the correct span name on trace creation.
	//
	// For backwards compatibility this option is off by default.
	OperationNameLateBinding bool

	// Initial configuration of the sampling strategies (usually retrieved from the backend by Remote Sampler).
	Strategies *sampling.PerOperationSamplingStrategies
}

const maxRandomNumber = ^(uint64(1) << 63) // i.e. 0x7fffffffffffffff

// SamplerTypeLowerBound is the type of sampler that samples
// at least a fixed number of traces per second.
const (
	SamplerTypeLowerBound = "lowerbound"
	// SamplerTypeProbabilistic is the type of sampler that samples traces
	// with a certain fixed probability.
	SamplerTypeProbabilistic = "probabilistic"
)

type ProbabilisticSampler struct {
	legacySamplerV1Base
	samplingRate     float64
	samplingBoundary uint64
	tags             []Tag
}

type GuaranteedThroughputProbabilisticSampler struct {
	probabilisticSampler *ProbabilisticSampler
	lowerBoundSampler    *RateLimitingSampler
	tags                 []Tag
	samplingRate         float64
	lowerBound           float64
}

// PerOperationSampler is a delegating sampler that applies GuaranteedThroughputProbabilisticSampler
// on a per-operation basis.
type PerOperationSampler struct {
	sync.RWMutex

	samplers       map[string]*GuaranteedThroughputProbabilisticSampler
	defaultSampler *ProbabilisticSampler
	lowerBound     float64
	maxOperations  int

	// see description in PerOperationSamplerParams
	operationNameLateBinding bool
}

// NewGuaranteedThroughputProbabilisticSampler returns a delegating sampler that applies both
// ProbabilisticSampler and RateLimitingSampler.
func NewGuaranteedThroughputProbabilisticSampler(
	lowerBound, samplingRate float64,
) (*GuaranteedThroughputProbabilisticSampler, error) {
	return newGuaranteedThroughputProbabilisticSampler(lowerBound, samplingRate), nil
}

func newGuaranteedThroughputProbabilisticSampler(lowerBound, samplingRate float64) *GuaranteedThroughputProbabilisticSampler {
	s := &GuaranteedThroughputProbabilisticSampler{
		lowerBoundSampler: NewRateLimitingSampler(lowerBound),
		lowerBound:        lowerBound,
	}
	s.setProbabilisticSampler(samplingRate)
	return s
}

func (s *ProbabilisticSampler) init(samplingRate float64) *ProbabilisticSampler {
	s.samplingRate = math.Max(0.0, math.Min(samplingRate, 1.0))
	s.samplingBoundary = uint64(float64(maxRandomNumber) * s.samplingRate)
	s.tags = []Tag{
		{key: SamplerTypeTagKey, value: SamplerTypeProbabilistic},
		{key: SamplerParamTagKey, value: s.samplingRate},
	}
	return s
}

func newProbabilisticSampler(samplingRate float64) *ProbabilisticSampler {
	s := new(ProbabilisticSampler)
	s.delegate = s.IsSampled
	return s.init(samplingRate)
}

// IsSampled implements IsSampled() of Sampler.
func (s *ProbabilisticSampler) IsSampled(id TraceID, operation string) (bool, []Tag) {
	return s.samplingBoundary >= id.Low&maxRandomNumber, s.tags
}

// SamplingRate returns the sampling probability this sampled was constructed with.
func (s *ProbabilisticSampler) SamplingRate() float64 {
	return s.samplingRate
}

func (s *GuaranteedThroughputProbabilisticSampler) setProbabilisticSampler(samplingRate float64) {
	if s.probabilisticSampler == nil {
		s.probabilisticSampler = newProbabilisticSampler(samplingRate)
	} else if s.samplingRate != samplingRate {
		s.probabilisticSampler.init(samplingRate)
	}
	// since we don't validate samplingRate, sampler may have clamped it to [0, 1] interval
	samplingRate = s.probabilisticSampler.SamplingRate()
	if s.samplingRate != samplingRate || s.tags == nil {
		s.samplingRate = s.probabilisticSampler.SamplingRate()
		s.tags = []Tag{
			{key: SamplerTypeTagKey, value: SamplerTypeLowerBound},
			{key: SamplerParamTagKey, value: s.samplingRate},
		}
	}
}

// NewPerOperationSampler returns a new PerOperationSampler.
func NewPerOperationSampler(params PerOperationSamplerParams) *PerOperationSampler {
	if params.MaxOperations <= 0 {
		params.MaxOperations = defaultMaxOperations
	}
	samplers := make(map[string]*GuaranteedThroughputProbabilisticSampler)
	for _, strategy := range params.Strategies.PerOperationStrategies {
		sampler := newGuaranteedThroughputProbabilisticSampler(
			params.Strategies.DefaultLowerBoundTracesPerSecond,
			strategy.ProbabilisticSampling.SamplingRate,
		)
		samplers[strategy.Operation] = sampler
	}
	return &PerOperationSampler{
		samplers:                 samplers,
		defaultSampler:           newProbabilisticSampler(params.Strategies.DefaultSamplingProbability),
		lowerBound:               params.Strategies.DefaultLowerBoundTracesPerSecond,
		maxOperations:            params.MaxOperations,
		operationNameLateBinding: params.OperationNameLateBinding,
	}
}

func NewProbabilisticSampler(samplingRate float64) (*ProbabilisticSampler, error) {
	if samplingRate < 0.0 || samplingRate > 1.0 {
		return nil, fmt.Errorf("sampling Rate must be between 0.0 and 1.0, received %f", samplingRate)
	}
	return newProbabilisticSampler(samplingRate), nil
}

// Update modifies in-place the sampling rate. Locking must be done externally.
func (s *ProbabilisticSampler) Update(samplingRate float64) error {
	if samplingRate < 0.0 || samplingRate > 1.0 {
		return fmt.Errorf("sampling Rate must be between 0.0 and 1.0, received %f", samplingRate)
	}
	s.init(samplingRate)
	return nil
}

// Equal implements Equal() of Sampler.
func (s *ProbabilisticSampler) Equal(other Sampler) bool {
	if o, ok := other.(*ProbabilisticSampler); ok {
		return s.samplingBoundary == o.samplingBoundary
	}
	return false
}
