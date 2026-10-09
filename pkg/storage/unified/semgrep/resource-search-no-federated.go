//go:build ignore

package semgreptest

import resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"

func literal(key *resourcepb.ResourceKey) *resourcepb.ResourceSearchRequest {
	// ruleid: resource-search-no-federated
	return &resourcepb.ResourceSearchRequest{
		Limit:     10,
		Federated: []*resourcepb.ResourceKey{key},
	}
}

func assigned(request *resourcepb.ResourceSearchRequest, key *resourcepb.ResourceKey) {
	// ruleid: resource-search-no-federated
	request.Federated = []*resourcepb.ResourceKey{key}
}

func appended(request *resourcepb.ResourceSearchRequest, key *resourcepb.ResourceKey) {
	// ruleid: resource-search-no-federated
	request.Federated = append(request.Federated, key)
}

func localPointer(key *resourcepb.ResourceKey) *resourcepb.ResourceSearchRequest {
	request := &resourcepb.ResourceSearchRequest{Limit: 10}
	// ruleid: resource-search-no-federated
	request.Federated = []*resourcepb.ResourceKey{key}
	return request
}

func localValue(key *resourcepb.ResourceKey) resourcepb.ResourceSearchRequest {
	var request resourcepb.ResourceSearchRequest
	// ruleid: resource-search-no-federated
	request.Federated = []*resourcepb.ResourceKey{key}
	return request
}

type handler struct {
	request *resourcepb.ResourceSearchRequest
}

func structField(h *handler, key *resourcepb.ResourceKey) {
	// ruleid: resource-search-no-federated
	h.request.Federated = []*resourcepb.ResourceKey{key}
}

func buildRequest() (*resourcepb.ResourceSearchRequest, error) {
	return &resourcepb.ResourceSearchRequest{}, nil
}

func helperWithError(key *resourcepb.ResourceKey) {
	request, _ := buildRequest()
	// ruleid: resource-search-no-federated
	request.Federated = []*resourcepb.ResourceKey{key}
}

func newRequest() *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{}
}

// Semgrep does not infer the type of a single value returned by a helper.
func helperSingleValue(key *resourcepb.ResourceKey) {
	request := newRequest()
	// todoruleid: resource-search-no-federated
	request.Federated = []*resourcepb.ResourceKey{key}
}

type otherConfig struct {
	Federated bool
}

func unrelatedType(cfg *otherConfig) {
	// ok: resource-search-no-federated
	cfg.Federated = true
}

func singleResource(key *resourcepb.ResourceKey) *resourcepb.ResourceSearchRequest {
	// ok: resource-search-no-federated
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: key},
	}
}
