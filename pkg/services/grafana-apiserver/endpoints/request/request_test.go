package request_test

import (
	"context"
	"mime"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/handlers/negotiation"

	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

func TestParseNamespace(t *testing.T) {
	tests := []struct {
		name      string
		namespace string
		expected  grafanarequest.NamespaceInfo
		expectErr bool
	}{
		{
			name: "empty namespace",
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "incorrect number of parts",
			namespace: "org-123-a",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "org id not a number",
			namespace: "org-invalid",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "valid org id",
			namespace: "org-123",
			expected: grafanarequest.NamespaceInfo{
				OrgID: 123,
			},
		},
		{
			name:      "org should not be 1 in the namespace",
			namespace: "org-1",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "can not be negative",
			namespace: "org--5",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "can not be zero",
			namespace: "org-0",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "default is org 1",
			namespace: "default",
			expected: grafanarequest.NamespaceInfo{
				OrgID: 1,
			},
		},
		{
			name:      "valid stack",
			namespace: "stack-abcdef",
			expected: grafanarequest.NamespaceInfo{
				OrgID:   1,
				StackID: "abcdef",
			},
		},
		{
			name:      "invalid stack id",
			namespace: "stack-",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "invalid stack id (too short)",
			namespace: "stack-1",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID:   -1,
				StackID: "1",
			},
		},
		{
			name:      "other namespace",
			namespace: "anything",
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
				Value: "anything",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info, err := grafanarequest.ParseNamespace(tt.namespace)
			if tt.expectErr != (err != nil) {
				t.Errorf("ParseNamespace() returned %+v, expected an error", info)
			}
			if info.OrgID != tt.expected.OrgID {
				t.Errorf("ParseNamespace() [OrgID] returned %d, expected %d", info.OrgID, tt.expected.OrgID)
			}
			if info.StackID != tt.expected.StackID {
				t.Errorf("ParseNamespace() [StackID] returned %s, expected %s", info.StackID, tt.expected.StackID)
			}
			if info.Value != tt.namespace {
				t.Errorf("ParseNamespace() [Value] returned %s, expected %s", info.Value, tt.namespace)
			}
		})
	}
}

func TestOutputMediaType(t *testing.T) {
	tests := []struct {
		name     string
		ctx      context.Context
		req      *http.Request
		expected *schema.GroupVersionKind
		ok       bool
	}{
		{
			name: "request for table conversion",
			ctx:  context.Background(),
			req: &http.Request{
				Header: http.Header{
					"Accept": []string{"application/json;as=Table;g=meta.k8s.io;v=v1"},
				},
			},
			expected: &schema.GroupVersionKind{
				Group:   "meta.k8s.io",
				Version: "v1",
				Kind:    "Table",
			},
			ok: true,
		},
		{
			name: "application/json",
			req: &http.Request{
				Header: http.Header{
					"Accept": []string{"application/bson"},
				},
			},
			ctx:      context.Background(),
			expected: nil,
			ok:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := grafanarequest.WithOutputMediaType(
				tt.ctx,
				tt.req,
				&fakeNegotiater{serializer: fakeCodec, types: []string{"application/json;as=Table;v=v1;g=meta.k8s.io"}},
				negotiation.DefaultEndpointRestrictions,
			)
			actual, ok := grafanarequest.OutputMediaTypeFrom(ctx)
			require.Equal(t, tt.ok, ok)
			require.Equal(t, tt.expected, actual.Convert)
		})
	}
}

type fakeNegotiater struct {
	serializer, streamSerializer runtime.Serializer
	framer                       runtime.Framer
	types, streamTypes           []string
}

func (n *fakeNegotiater) SupportedMediaTypes() []runtime.SerializerInfo {
	var out []runtime.SerializerInfo
	for _, s := range n.types {
		mediaType, _, err := mime.ParseMediaType(s)
		if err != nil {
			panic(err)
		}
		parts := strings.SplitN(mediaType, "/", 2)
		if len(parts) == 1 {
			// this is an error on the server side
			parts = append(parts, "")
		}

		info := runtime.SerializerInfo{
			Serializer:       n.serializer,
			PrettySerializer: n.serializer,
			MediaType:        s,
			MediaTypeType:    parts[0],
			MediaTypeSubType: parts[1],
			EncodesAsText:    true,
		}
		for _, t := range n.streamTypes {
			if t == s {
				info.StreamSerializer = &runtime.StreamSerializerInfo{
					EncodesAsText: true,
					Framer:        n.framer,
					Serializer:    n.streamSerializer,
				}
			}
		}
		out = append(out, info)
	}
	return out
}

func (n *fakeNegotiater) EncoderForVersion(serializer runtime.Encoder, gv runtime.GroupVersioner) runtime.Encoder {
	return n.serializer
}

func (n *fakeNegotiater) DecoderToVersion(serializer runtime.Decoder, gv runtime.GroupVersioner) runtime.Decoder {
	return n.serializer
}

var fakeCodec = unstructured.UnstructuredJSONScheme
