package search

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type DocumentBuilderProvider interface {
	GetDocumentBuilders(ctx context.Context) ([]resource.DocumentBuilderInfo, error)
}

// Replaced in enterprise with a version that includes stats
func ProvideBuilders() DocumentBuilderProvider {
	return &standardDocumentProvider{}
}

type standardDocumentProvider struct {
	_ int // sealed
}

type defaultDocumentBuilder struct {
	_ int // sealed
}

var (
	_ resource.DocumentBuilder = &defaultDocumentBuilder{}
	_ DocumentBuilderProvider  = &standardDocumentProvider{}
)

func (p *standardDocumentProvider) GetDocumentBuilders(ctx context.Context) ([]resource.DocumentBuilderInfo, error) {
	return []resource.DocumentBuilderInfo{
		{
			Group:    "",
			Resource: "",
			Builder:  &defaultDocumentBuilder{},
		},
		{
			Group:    "dashboard.grafana.app",
			Resource: "dashboards",

			// This is a dummy example, and will need resolver setup for enterprise stats and and (eventually) data sources
			Namespaced: func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
				lookup := dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{
					// TODO, query data sources
				})
				return &DashboardDocumentBuilder{
					Namespace: namespace,
					Lookup:    lookup,
					Stats:     nil, // loaded in enterprise
					Blob:      blob,
				}, nil
			},
		},
	}, nil
}

func (_ *defaultDocumentBuilder) BuildDocument(_ context.Context, key *resource.ResourceKey, rv int64, value []byte) (resource.IndexableDocument, error) {
	tmp := &unstructured.Unstructured{}
	err := tmp.UnmarshalJSON(value)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return nil, err
	}

	doc := &StandardDocumentFields{}
	doc.Load(key, rv, obj)

	doc.Title = obj.FindTitle(doc.Name)
	doc.ByteSize = len(value)

	return doc, nil
}

// This is common across all resources
type StandardDocumentFields struct {
	// unique ID across everything (group+resource+namespace+name)
	ID string `json:"id"`
	RV int64  `json:"rv"`

	Group     string `json:"group"`
	Resource  string `json:"resource"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`

	Folder      string   `json:"folder,omitempty"`
	Title       string   `json:"title,omitempty"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	ByteSize    int      `json:"byte_size,omitempty"`

	// Standard k8s style labels
	Labels map[string]string `json:"labels,omitempty"`

	Created   time.Time  `json:"created,omitempty"`
	CreatedBy string     `json:"created_by,omitempty"`
	Updated   *time.Time `json:"updated,omitempty"`
	UpdatedBy string     `json:"updated_by,omitempty"`

	OriginName string `json:"origin_name,omitempty"`
	OriginPath string `json:"origin_path,omitempty"`
	OriginHash string `json:"origin_hash,omitempty"`
	OriginTime int64  `json:"origin_time,omitempty"`
}

func (s *StandardDocumentFields) GetID() string {
	return s.ID
}

// Load values from standard object
func (s *StandardDocumentFields) Load(key *resource.ResourceKey, rv int64, obj utils.GrafanaMetaAccessor) {
	s.ID = toID(key)
	s.RV = rv
	s.Labels = obj.GetLabels()

	s.Group = key.Group
	s.Resource = key.Resource
	s.Namespace = key.Namespace
	s.Name = key.Name

	s.Folder = obj.GetFolder()
	s.Created = obj.GetCreationTimestamp().Time
	s.CreatedBy = obj.GetCreatedBy()

	s.Updated, _ = obj.GetUpdatedTimestamp()
	s.UpdatedBy = obj.GetUpdatedBy()

	origin, _ := obj.GetOriginInfo()
	if origin != nil {
		s.OriginName = origin.Name
		s.OriginPath = origin.Path
		s.OriginHash = origin.Hash
		if origin.Timestamp != nil {
			s.OriginTime = origin.Timestamp.UnixMilli()
		}
	}
}

func toID(key *resource.ResourceKey) string {
	h := sha256.New()

	sep := []byte("/")
	h.Write([]byte(key.Group))
	h.Write(sep)
	h.Write([]byte(key.Resource))
	h.Write(sep)
	h.Write([]byte(key.Namespace))
	h.Write(sep)
	h.Write([]byte(key.Name))

	// ??? are the first 20 characters enough?
	// github uses 7*hex as identifiers ???
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}
