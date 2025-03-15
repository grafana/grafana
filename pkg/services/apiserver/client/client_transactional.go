package client

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/retryer"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/selection"
)

type K8sHandlerTransactional struct {
	K8sHandler
}

func NewK8sHandlerTransactional(handler *k8sHandler) *K8sHandlerTransactional {
	return &K8sHandlerTransactional{
		K8sHandler: handler,
	}
}

func (h *K8sHandlerTransactional) Create(ctx context.Context, obj *unstructured.Unstructured, orgID int64) (*unstructured.Unstructured, error) {
	// create obj
	obj, err := h.K8sHandler.Create(ctx, obj, orgID)
	if err != nil {
		return nil, err
	}

	// wait until indexer has the change
	err = h.WaitForSearchQuery(ctx, orgID, existsQuery(obj.GetName()), 3, 1)
	if err != nil {
		return nil, err
	}
	return obj, err
}

func (h *K8sHandlerTransactional) Update(ctx context.Context, obj *unstructured.Unstructured, orgID int64) (*unstructured.Unstructured, error) {
	// update obj
	obj, err := h.K8sHandler.Update(ctx, obj, orgID)
	if err != nil {
		return nil, err
	}

	// wait until indexer has the object with an updated RV
	err = h.WaitForSearchQuery(ctx, orgID, updatedQuery(obj.GetResourceVersion()), 3, 1)
	if err != nil {
		return nil, err
	}
	return obj, err
}

func (h *K8sHandlerTransactional) Delete(ctx context.Context, name string, orgID int64, options v1.DeleteOptions) error {
	// delete obj
	err := h.K8sHandler.Delete(ctx, name, orgID, options)
	if err != nil {
		return err
	}

	// wait until indexer has the change
	return h.WaitForSearchQuery(ctx, orgID, existsQuery(name), 3, 0)
}

func updatedQuery(rv string) *resource.ResourceSearchRequest {
	return &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Fields: []*resource.Requirement{{
				Key:      resource.SEARCH_FIELD_RV,
				Operator: string(selection.Equals),
				Values:   []string{rv},
			},
			},
		},
		Limit: 1}
}

func existsQuery(objName string) *resource.ResourceSearchRequest {
	return &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Fields: []*resource.Requirement{{
				Key:      resource.SEARCH_FIELD_NAME,
				Operator: string(selection.Equals),
				Values:   []string{objName},
			},
			},
		},
		Limit: 1}
}

// WaitForSearchQuery waits for the search query to return the expected number of hits.
// Since US doesn't offer read-after-write guarantees, we can use this to wait after writes until the indexer is up to date.
func (h *K8sHandlerTransactional) WaitForSearchQuery(ctx context.Context, orgID int64, query *resource.ResourceSearchRequest, maxRetries int, expectedHits int64) error {
	return retryer.Retry(func() (retryer.RetrySignal, error) {
		results, err := h.K8sHandler.Search(ctx, orgID, query)
		if err != nil {
			return retryer.FuncError, err
		}
		if results.TotalHits == expectedHits {
			return retryer.FuncComplete, nil
		}
		return retryer.FuncFailure, nil
	}, maxRetries, 1*time.Second, 5*time.Second)
}
