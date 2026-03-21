package queryhistory

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	qhv0alpha1 "github.com/grafana/grafana/apps/queryhistory/pkg/apis/queryhistory/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	queryhistorysvc "github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
	_ rest.CollectionDeleter    = (*legacyStorage)(nil)
	_ rest.TableConvertor       = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service        queryhistorysvc.Service
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return qhv0alpha1.QueryHistoryResourceInfo.NewFunc()
}

func (s *legacyStorage) NewList() runtime.Object {
	return qhv0alpha1.QueryHistoryResourceInfo.NewListFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

// getSignedInUser extracts a *user.SignedInUser from context.
func getSignedInUser(ctx context.Context) (*user.SignedInUser, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	signedInUser, ok := requester.(*user.SignedInUser)
	if !ok {
		return nil, fmt.Errorf("expected *user.SignedInUser, got %T", requester)
	}
	return signedInUser, nil
}

func dtoToResource(dto *queryhistorysvc.QueryHistoryDTO, namespace string) (*qhv0alpha1.QueryHistory, error) {
	obj := qhv0alpha1.NewQueryHistory()
	obj.Name = dto.UID
	obj.Namespace = namespace
	obj.CreationTimestamp = metav1.NewTime(time.Unix(dto.CreatedAt, 0))
	obj.Labels = map[string]string{
		"grafana.app/datasource-uid": dto.DatasourceUID,
	}
	obj.Spec.DatasourceUid = dto.DatasourceUID
	obj.Spec.Comment = &dto.Comment

	if dto.Queries != nil {
		var raw interface{}
		b, err := dto.Queries.MarshalJSON()
		if err != nil {
			return nil, fmt.Errorf("failed to marshal queries: %w", err)
		}
		if err := json.Unmarshal(b, &raw); err != nil {
			return nil, fmt.Errorf("failed to unmarshal queries: %w", err)
		}
		obj.Spec.Queries = raw
	}

	return obj, nil
}

func (s *legacyStorage) GetSingularName() string {
	return qhv0alpha1.QueryHistoryResourceInfo.GetSingularName()
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	// The legacy service doesn't have a direct Get-by-UID method.
	// Search with a broad query and filter by UID.
	u, err := getSignedInUser(ctx)
	if err != nil {
		return nil, err
	}

	query := queryhistorysvc.SearchInQueryHistoryQuery{
		Limit: 1000,
		Page:  1,
	}

	result, err := s.service.SearchInQueryHistory(ctx, u, query)
	if err != nil {
		return nil, err
	}

	for i := range result.QueryHistory {
		if result.QueryHistory[i].UID == name {
			return dtoToResource(&result.QueryHistory[i], "")
		}
	}

	return nil, fmt.Errorf("query history item %q not found", name)
}

func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("delete collection not supported for query history")
}

func (s *legacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	u, err := getSignedInUser(ctx)
	if err != nil {
		return nil, err
	}

	qh, ok := obj.(*qhv0alpha1.QueryHistory)
	if !ok {
		return nil, fmt.Errorf("expected QueryHistory object")
	}

	queriesJSON, err := json.Marshal(qh.Spec.Queries)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal queries: %w", err)
	}

	cmd := queryhistorysvc.CreateQueryInQueryHistoryCommand{
		DatasourceUID: qh.Spec.DatasourceUid,
		Queries:       simplejson.NewFromAny(json.RawMessage(queriesJSON)),
	}

	dto, err := s.service.CreateQueryInQueryHistory(ctx, u, cmd)
	if err != nil {
		return nil, err
	}

	return dtoToResource(&dto, qh.Namespace)
}

func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	u, err := getSignedInUser(ctx)
	if err != nil {
		return nil, false, err
	}

	_, err = s.service.DeleteQueryFromQueryHistory(ctx, u, name)
	if err != nil {
		return nil, false, err
	}

	return nil, true, nil
}

func (s *legacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	u, err := getSignedInUser(ctx)
	if err != nil {
		return nil, false, err
	}

	newObj, err := objInfo.UpdatedObject(ctx, nil)
	if err != nil {
		return nil, false, err
	}

	qh, ok := newObj.(*qhv0alpha1.QueryHistory)
	if !ok {
		return nil, false, fmt.Errorf("expected QueryHistory object")
	}

	comment := ""
	if qh.Spec.Comment != nil {
		comment = *qh.Spec.Comment
	}

	cmd := queryhistorysvc.PatchQueryCommentInQueryHistoryCommand{
		Comment: comment,
	}

	dto, err := s.service.PatchQueryCommentInQueryHistory(ctx, u, name, cmd)
	if err != nil {
		return nil, false, err
	}

	result, err := dtoToResource(&dto, qh.Namespace)
	if err != nil {
		return nil, false, err
	}
	return result, false, nil
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	u, err := getSignedInUser(ctx)
	if err != nil {
		return nil, err
	}

	query := queryhistorysvc.SearchInQueryHistoryQuery{
		Limit: 100,
		Page:  1,
	}

	result, err := s.service.SearchInQueryHistory(ctx, u, query)
	if err != nil {
		return nil, err
	}

	list := &qhv0alpha1.QueryHistoryList{}
	for i := range result.QueryHistory {
		item, err := dtoToResource(&result.QueryHistory[i], "")
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, *item)
	}

	return list, nil
}
