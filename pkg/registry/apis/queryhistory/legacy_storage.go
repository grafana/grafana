package queryhistory

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
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
	_ rest.Storage              = (*LegacyStorage)(nil)
	_ rest.Scoper               = (*LegacyStorage)(nil)
	_ rest.SingularNameProvider = (*LegacyStorage)(nil)
	_ rest.Getter               = (*LegacyStorage)(nil)
	_ rest.Lister               = (*LegacyStorage)(nil)
	_ rest.Creater              = (*LegacyStorage)(nil)
	_ rest.Updater              = (*LegacyStorage)(nil)
	_ rest.GracefulDeleter      = (*LegacyStorage)(nil)
	_ rest.CollectionDeleter    = (*LegacyStorage)(nil)
	_ rest.TableConvertor       = (*LegacyStorage)(nil)
)

type LegacyStorage struct {
	service        queryhistorysvc.Service
	tableConverter rest.TableConvertor
}

func NewLegacyStorage(service queryhistorysvc.Service) *LegacyStorage {
	return &LegacyStorage{
		service:        service,
		tableConverter: qhv0alpha1.QueryHistoryResourceInfo.TableConverter(),
	}
}

func (s *LegacyStorage) New() runtime.Object {
	return qhv0alpha1.QueryHistoryResourceInfo.NewFunc()
}

func (s *LegacyStorage) NewList() runtime.Object {
	return qhv0alpha1.QueryHistoryResourceInfo.NewListFunc()
}

func (s *LegacyStorage) Destroy() {}

func (s *LegacyStorage) NamespaceScoped() bool {
	return true
}

func (s *LegacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
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
		b, err := dto.Queries.MarshalJSON()
		if err != nil {
			return nil, fmt.Errorf("failed to marshal queries: %w", err)
		}
		obj.Spec.Queries = json.RawMessage(b)
	}

	return obj, nil
}

func (s *LegacyStorage) GetSingularName() string {
	return qhv0alpha1.QueryHistoryResourceInfo.GetSingularName()
}

func (s *LegacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	u, err := getSignedInUser(ctx)
	if err != nil {
		return nil, err
	}

	dto, err := s.service.GetQueryByUID(ctx, u, name)
	if err != nil {
		return nil, err
	}

	return dtoToResource(&dto, "")
}

func (s *LegacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(qhv0alpha1.QueryHistoryResourceInfo.GroupResource(), "deleteCollection")
}

func (s *LegacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
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

func (s *LegacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
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

func (s *LegacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
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

func (s *LegacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	u, err := getSignedInUser(ctx)
	if err != nil {
		return nil, err
	}

	limit := 100
	if options != nil && options.Limit > 0 {
		limit = int(options.Limit)
	}
	if limit > 1000 {
		limit = 1000
	}

	query := queryhistorysvc.SearchInQueryHistoryQuery{
		Limit: limit,
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
