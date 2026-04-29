// Package embedder defines the contract for text-to-vector embedding
// providers and a thin layer that maps extractor Items to vector.Vector
// rows ready for the pgvector backend.
//
// Provider implementations live in subpackages (vertex, bedrock).
package embedder

import (
	"context"
)

// VectorType is dense or sparse. We only do dense in this package.
type VectorType string

const (
	VectorTypeDense VectorType = "dense"
)

// DistanceMetric is how the vector store compares embeddings. Recorded on
// the Embedder so the orchestrator and search side stay in sync.
type DistanceMetric string

const (
	CosineDistance DistanceMetric = "cosine"
)

// Truncation tells providers how to handle texts that exceed the model's
// token limit.
type Truncation int

const (
	TruncateNone  Truncation = iota // error if any text exceeds the limit
	TruncateRight                   // drop the tail
	TruncateLeft                    // drop the head
)

/*
Task is a provider-specific hint. Vertex uses task_type; Bedrock Cohere
uses input_type. Providers translate generically-named tasks to their own values.

Queries and documents have asymmetric shapes. A query is short and intent-oriented ("dashboards about API latency"). A document is
longer and content-oriented ("API Latency → p99 latency → histogram_quantile(0.99, ...)"). Models like Vertex Gemini Embedding and Cohere embed-v4 are trained
with separate task-aware projections so that a short query vector lands close to its semantically-matching long document vector, even though their surface text
looks different.
*/
type Task string

const (
	TaskRetrievalDocument Task = "Retrieval"
	TaskRetrievalQuery    Task = "Query"
)

// Embedding is one vector. Dense-only for now; the field shape leaves room
// for a sparse companion if we ever need it.
type Embedding struct {
	Dense []float32
}

// EmbedTextInput is what callers pass to TextEmbedder.EmbedText.
//
// Texts is the batch — providers chunk internally to fit per-call limits,
// so callers can pass arbitrarily large slices. The output preserves order:
// Embeddings[i] is the embedding of Texts[i].
type EmbedTextInput struct {
	Texts     []string
	Normalize bool
	Truncate  Truncation
	Task      Task
	// Tenant labels metrics for per-caller attribution. Empty is fine.
	Tenant string
}

// EmbedTextOutput holds embeddings 1:1 with EmbedTextInput.Texts.
type EmbedTextOutput struct {
	Embeddings []Embedding
}

// TextEmbedder is the provider-facing interface — a single method that
// embeds a batch of texts. Implementations live in vertex/, bedrock/.
type TextEmbedder interface {
	EmbedText(ctx context.Context, input EmbedTextInput) (EmbedTextOutput, error)
}

// Embedder bundles a TextEmbedder with the metadata callers need to stamp
// onto vector.Vector rows (Model, Dimensions) and to decide whether to ask
// for client-side normalization (VectorType, Metric, Normalized).
type Embedder struct {
	TextEmbedder
	// Model is the canonical model identifier persisted on each Vector,
	// e.g. "vertex/text-embedding-005" or "bedrock/cohere.embed-v4".
	Model      string
	VectorType VectorType
	Metric     DistanceMetric
	Dimensions uint32
	// MaxTokens is the per-text token cap the provider enforces. Informational.
	MaxTokens uint32
	// Normalized is true when the provider already returns L2-normalized
	// vectors. ShouldNormalize uses it to decide whether to ask for
	// client-side normalization.
	Normalized bool
}

// ShouldNormalize reports whether to set EmbedTextInput.Normalize=true for
// this embedder. Cosine search benefits from unit-norm vectors (then cosine
// reduces to dot product); we only need to normalize ourselves when the
// provider doesn't already.
func (e Embedder) ShouldNormalize() bool {
	return e.VectorType == VectorTypeDense && e.Metric == CosineDistance && !e.Normalized
}

// Registry is a name → Embedder lookup, populated at wiring time. Multiple
// embedders can be registered under different names (e.g. one for indexing,
// one for query rewriting).
type Registry struct {
	embedders map[string]Embedder
}

func NewRegistry() *Registry {
	return &Registry{embedders: make(map[string]Embedder)}
}

func (r *Registry) Register(name string, e Embedder) *Registry {
	if name == "" || e.TextEmbedder == nil {
		return r
	}
	r.embedders[name] = e
	return r
}

func (r *Registry) Get(name string) (Embedder, bool) {
	e, ok := r.embedders[name]
	return e, ok
}
