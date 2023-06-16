package next

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/kinds"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/storage"
)

type BaseEntityObject = kinds.GrafanaResource[any, any]

type EntityInput interface {
	GetAPIVersion() string
	GetKind() string
	GetMeta() kinds.GrafanaResourceMetadata

	// byte
	GetBody() ([]byte, error)

	// Note the summary is not included in the JSON body
	GetSummary() EntitySummary
}

type EntityIdentifier struct {
	APIVersion      string `json:"apiVersion"`
	Kind            string `json:"kind"`
	Namespace       string `json:"namespace,omitempty"`
	Name            string `json:"name,omitempty"`
	ResourceVersion string `json:"resourceVersion,omitempty"`
}

// TODO some flavor of ListInterface
type PagedResult[Result interface{}] struct {
	Total     string   `json:"total,omitempty"`
	FromToken string   `json:"fromToken,omitempty"`
	NextToken string   `json:"nextToken,omitempty"`
	Values    []Result `json:"values"`
}

type EntityStore interface {
	Create(ctx context.Context, obj EntityInput) error
	Read(ctx context.Context, obj EntityIdentifier) ([]byte, error)
	Update(ctx context.Context, obj EntityInput) error
	Delete(ctx context.Context, obj EntityIdentifier) error

	// Delegate as much as possible to the query engine
	List(ctx context.Context, obj EntityIdentifier, opts storage.ListOptions, fmt string) (metav1.ListInterface, error)

	// Find references into or out of the storage engine
	GetHistory(ctx context.Context, obj EntityIdentifier, nextToken string) (PagedResult[EntityHistory], error)

	// Find references into or out of the storage engine
	GetReferences(ctx context.Context, obj EntityIdentifier, direction bool, nextToken string) (PagedResult[EntityReferenceStatus], error)
}

// EntitySummary represents common data derived from a raw object bytes.
// The values should not depend on system state, and are derived from the raw object.
// This summary is used for a unified search and object listing
type EntitySummary struct {
	Title       string   `json:"title,omitempty"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`

	// Correct enough that we can index/save, but it has errors
	Error *EntityErrorInfo `json:"error,omitempty"`

	// Optional field values.  The schema will define and document possible values for a given kind
	Fields map[string]interface{} `json:"fields,omitempty"`

	// eg: panels within dashboard
	Nested []*NestedEntitySummary `json:"nested,omitempty"`

	// Optional references to external things
	References []*EntityExternalReference `json:"references,omitempty"`
}

type NestedEntitySummary struct {
	EntitySummary

	// Category of dependency
	// eg: datasource, plugin, runtime
	Path string `json:"path,omitempty"`

	// eg, panel in a dashbaord
	Type string `json:"type,omitempty"` // flavor
}

// Reference to another object outside itself
// This message is derived from the object body and can be used to search for references.
// This does not represent a method to declare a reference to another object.
type EntityExternalReference struct {
	// Category of dependency
	// eg: datasource, plugin, runtime
	Family string `json:"family,omitempty"`

	// datasource > prometheus|influx|...
	// plugin > panel | datasource
	// runtime > transformer
	Type string `json:"type,omitempty"` // flavor

	// datasource > UID
	// plugin > plugin identifier
	// runtime > name lookup
	Identifier string `json:"ID,omitempty"`
}

type EntityErrorInfo struct {
	// Match an error code registry?
	Code int64 `protobuf:"varint,1,opt,name=code,proto3" json:"code,omitempty"`
	// Simple error display
	Message string `protobuf:"bytes,2,opt,name=message,proto3" json:"message,omitempty"`
	// Details encoded in JSON
	DetailsJson []byte `protobuf:"bytes,3,opt,name=details_json,json=detailsJson,proto3" json:"details_json,omitempty"`
}

type EntityReferenceStatus struct {
	Family     string `json:"family,omitempty"`
	Type       string `json:"type,omitempty"`
	Identifier string `json:"ID,omitempty"`

	Resolved  bool       `json:"resolved"`
	Warning   string     `json:"warning,omitempty"`
	Timestamp *time.Time `json:"timestamp,omitempty"`
}

type EntityHistory struct {
	ResourceVersion string     `json:"resourceVersion,omitempty"`
	Message         string     `json:"message,omitempty"`
	UpdatedAt       *time.Time `json:"updatedAt,omitempty"`
	UpdatedBy       string     `json:"updatedBy,omitempty"`
	ETag            string     `json:"etag,omitempty"`
}
