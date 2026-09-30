package informer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// fakeStoreClient serves canned List pages and records the requests, so the gRPC
// keys lister can be exercised without a storage backend. Embedding the
// interface supplies the other (unused) methods.
type fakeStoreClient struct {
	resourcepb.ResourceStoreClient
	pages              []*resourcepb.ListResponse
	reqs               []*resourcepb.ListRequest
	sawServiceIdentity bool
}

func (f *fakeStoreClient) List(ctx context.Context, in *resourcepb.ListRequest, _ ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	if len(f.reqs) == 0 {
		f.sawServiceIdentity = identity.IsServiceIdentity(ctx) // else the in-process client rejects it: "no claims found"
	}
	f.reqs = append(f.reqs, in)
	return f.pages[len(f.reqs)-1], nil
}

func TestGRPCConnectionKeysLister(t *testing.T) {
	fake := &fakeStoreClient{pages: []*resourcepb.ListResponse{
		{
			Items: []*resourcepb.ResourceWrapper{
				{Namespace: "ns1", Name: "a", ResourceVersion: 10},
				{Namespace: "ns2", Name: "b", ResourceVersion: 11},
			},
			NextPageToken:   "tok",
			ResourceVersion: 100,
		},
		{
			Items:           []*resourcepb.ResourceWrapper{{Namespace: "ns1", Name: "c", ResourceVersion: 12}},
			NextPageToken:   "",
			ResourceVersion: 100,
		},
	}}

	// listRV comes from the eagerly-fetched first page, before the stream is drained.
	listRV, seq := NewGRPCConnectionKeysLister(fake).ListKeys(context.Background())
	assert.Equal(t, int64(100), listRV, "the snapshot resourceVersion is returned")

	var keys []Key
	for k, err := range seq {
		require.NoError(t, err)
		keys = append(keys, k)
	}

	assert.True(t, fake.sawServiceIdentity, "the re-list must authenticate as the service identity, or the in-process client rejects it with \"no claims found\"")

	require.Len(t, fake.reqs, 2, "one request per page")
	first := fake.reqs[0]
	assert.True(t, first.KeysOnly, "keys_only is set")
	assert.Empty(t, first.Options.Key.Namespace, "keys_only lists cluster-wide")
	assert.Equal(t, "connections", first.Options.Key.Resource)
	assert.Equal(t, "", first.NextPageToken, "first page carries no token")
	assert.Equal(t, "tok", fake.reqs[1].NextPageToken, "the continue token is forwarded")

	require.Len(t, keys, 3, "keys stream across pages")
	assert.Equal(t, Key{Namespace: "ns1", Name: "a", ResourceVersion: "10"}, keys[0])
	assert.Equal(t, Key{Namespace: "ns1", Name: "c", ResourceVersion: "12"}, keys[2])
}

// A server older than keys_only ignores the field and answers with bodies, whose
// items carry no name. Building keys from those would key every entry the same,
// so the lister has to refuse rather than synthesise.
func TestGRPCKeysLister_RefusesUnhonouredKeysOnly(t *testing.T) {
	honoured := &resourcepb.ResourceWrapper{Namespace: "ns1", Name: "a", ResourceVersion: 10}
	// What an older server returns: a body, and none of the key fields.
	bodyOnly := &resourcepb.ResourceWrapper{ResourceVersion: 10, Value: []byte(`{"kind":"Connection"}`)}

	for name, tc := range map[string]struct {
		pages    []*resourcepb.ListResponse
		wantKeys int
	}{
		"on the first page": {
			pages:    []*resourcepb.ListResponse{{Items: []*resourcepb.ResourceWrapper{bodyOnly}, ResourceVersion: 100}},
			wantKeys: 0,
		},
		// The guard runs per item, so a server that only degrades later is caught too.
		"on a later page": {
			pages: []*resourcepb.ListResponse{
				{Items: []*resourcepb.ResourceWrapper{honoured}, NextPageToken: "tok", ResourceVersion: 100},
				{Items: []*resourcepb.ResourceWrapper{bodyOnly}, ResourceVersion: 100},
			},
			wantKeys: 1,
		},
	} {
		t.Run(name, func(t *testing.T) {
			_, seq := NewGRPCConnectionKeysLister(&fakeStoreClient{pages: tc.pages}).ListKeys(context.Background())

			var keys []Key
			var gotErr error
			for k, err := range seq {
				if err != nil {
					gotErr = err
					break
				}
				keys = append(keys, k)
			}

			require.ErrorIs(t, gotErr, ErrKeysOnlyUnsupported)
			assert.Len(t, keys, tc.wantKeys, "keys before the unhonoured item still stream")
		})
	}
}

// The guard must not fire on the shape a current server returns.
func TestGRPCKeysLister_AcceptsHonouredKeysOnly(t *testing.T) {
	fake := &fakeStoreClient{pages: []*resourcepb.ListResponse{{
		Items:           []*resourcepb.ResourceWrapper{{Namespace: "ns1", Name: "a", ResourceVersion: 10}},
		ResourceVersion: 100,
	}}}

	_, seq := NewGRPCConnectionKeysLister(fake).ListKeys(context.Background())
	for k, err := range seq {
		require.NoError(t, err)
		assert.Equal(t, Key{Namespace: "ns1", Name: "a", ResourceVersion: "10"}, k)
	}
}
