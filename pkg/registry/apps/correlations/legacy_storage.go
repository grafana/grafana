package correlations

import (
	"context"
	b64 "encoding/base64"
	"fmt"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"

	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/correlations"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service        correlations.Service
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return correlationsV0.CorrelationKind().ZeroValue()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return strings.ToLower(correlationsV0.CorrelationKind().Kind())
}

func (s *legacyStorage) NewList() runtime.Object {
	return correlationsV0.CorrelationKind().ZeroListValue()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}
	// only allow selecting up to 100 datasources
	uids := make([]string, 0, 100)
	if options.LabelSelector != nil {
		reqs, selectable := options.LabelSelector.Requirements()

		if !selectable {
			return nil, fmt.Errorf("label not selectable")
		}

		for _, r := range reqs {
			if r.Key() == "correlations.grafana.app/sourceDS-ref" {
				if r.Operator() == selection.Equals || r.Operator() == selection.In {
					for _, item := range r.Values().List() {
						// if we are coming from legacy, we won't have a datasource type / group, so we can use the UID directly without splitting
						if strings.Contains(item, ".") {
							uids = append(uids, strings.Split(item, ".")[1])
						} else {
							uids = append(uids, item)
						}
					}
				} else {
					return nil, fmt.Errorf("unsupported operation")
				}
			} else {
				return nil, fmt.Errorf("unsupported label")
			}
		}
	}

	page := int64(0)
	limit := int64(100000)
	if options != nil {
		if options.Limit > 0 {
			limit = options.Limit
		}
		if options.Continue != "" {
			token, err := decodeContinueToken(options.Continue)
			if err != nil {
				return nil, err
			}
			if token.Limit != limit {
				return nil, fmt.Errorf("continue token limit does not match the previous request")
			}
			page = token.Page
		}
	}

	rsp, err := s.service.GetCorrelations(ctx, correlations.GetCorrelationsQuery{
		OrgId:      orgID,
		Limit:      limit + 1, // the plus one indicates we have reached the limit
		Page:       page,
		SourceUIDs: uids,
	})
	if err != nil {
		return nil, err
	}
	list := &correlationsV0.CorrelationList{
		Items: make([]correlationsV0.Correlation, 0, len(rsp.Correlations)),
	}

	for i, orig := range rsp.Correlations {
		if i >= int(limit) {
			remaining := rsp.TotalCount - (page * limit) - int64(len(list.Items))
			if remaining > 0 {
				list.RemainingItemCount = &remaining
			}

			list.Continue = encodeContinueToken(page+1, limit)
			break
		}

		c, err := correlations.ToResource(orig)
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, *c)
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}
	c, err := s.service.GetCorrelation(ctx, correlations.GetCorrelationQuery{
		UID:   name,
		OrgId: orgID,
	})
	if err != nil {
		return nil, err
	}

	return correlations.ToResource(c)
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	resource, ok := obj.(*correlationsV0.Correlation)
	if !ok {
		return nil, fmt.Errorf("expected correlation")
	}

	cmd, err := correlations.ToCreateCorrelationCommand(resource)
	if err != nil {
		return nil, err
	}

	out, err := s.service.CreateCorrelation(ctx, *cmd)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, out.UID, &metav1.GetOptions{})
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	before, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	obj, err := objInfo.UpdatedObject(ctx, before)
	if err != nil {
		return nil, false, err
	}

	resource, ok := obj.(*correlationsV0.Correlation)
	if !ok {
		return nil, false, fmt.Errorf("expected correlation")
	}

	cmd, err := correlations.ToUpdateCorrelationCommand(resource)
	if err != nil {
		return nil, false, err
	}

	out, err := s.service.UpdateCorrelation(ctx, *cmd)
	if err != nil {
		return nil, false, err
	}
	obj, err = s.Get(ctx, out.UID, &metav1.GetOptions{})
	return obj, false, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, false, err
	}
	err = s.service.DeleteCorrelation(ctx, correlations.DeleteCorrelationCommand{
		OrgId: orgID,
		UID:   name,
	})
	return nil, (err == nil), err
}

// CollectionDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	//fieldSelectors := listOptions.FieldSelector.Requirements()
	isSourceDelete := true
	datasourceToDelete := make(map[string]string)
	if dsGroup, ok := listOptions.FieldSelector.RequiresExactMatch("spec.source.group"); ok {
		datasourceToDelete["group"] = dsGroup
		if dsName, ok := listOptions.FieldSelector.RequiresExactMatch("spec.source.name"); ok {
			datasourceToDelete["name"] = dsName
		}
	}
	if dsGroup, ok := listOptions.FieldSelector.RequiresExactMatch("spec.target.group"); ok {
		isSourceDelete = false
		datasourceToDelete["group"] = dsGroup
		if dsName, ok := listOptions.FieldSelector.RequiresExactMatch("spec.target.name"); ok {
			datasourceToDelete["name"] = dsName
		}
	}
	labelSelector, _ := listOptions.LabelSelector.Requirements()
	if labelSelector[0].Key() == "correlations.grafana.app/sourceDSProv-ref" {
		datasourceData := strings.Split(labelSelector[0].Values().List()[0], ".")
		datasourceToDelete["group"] = datasourceData[0]
		datasourceToDelete["name"] = datasourceData[1]
		datasourceToDelete["provisioned"] = datasourceData[2]
	}

	if datasourceToDelete["name"] == "" || datasourceToDelete["group"] == "" {
		return nil, fmt.Errorf("deleteCollection to legacy passed invalid field or label selectors")
	}

	if isSourceDelete {
		isProvisioned := true
		if datasourceToDelete["provisioned"] == "false" {
			isProvisioned = false
		}
		return nil, s.service.DeleteCorrelationsBySourceUID(ctx, correlations.DeleteCorrelationsBySourceUIDCommand{SourceUID: datasourceToDelete["name"], SourceType: datasourceToDelete["group"], OrgId: orgID, OnlyProvisioned: isProvisioned})
	} else {
		return nil, s.service.DeleteCorrelationsByTargetUID(ctx, correlations.DeleteCorrelationsByTargetUIDCommand{TargetUID: datasourceToDelete["name"], TargetType: datasourceToDelete["group"], OrgId: orgID})
	}
}

type continueToken struct {
	Page  int64
	Limit int64
}

func encodeContinueToken(page, limit int64) string {
	data := fmt.Sprintf("%d/%d", page, limit)
	return b64.StdEncoding.EncodeToString([]byte(data)) // use base64 so it is not treated like query params
}

func decodeContinueToken(s string) (token continueToken, err error) {
	decoded, err := b64.StdEncoding.DecodeString(s)
	if err != nil {
		return token, fmt.Errorf("invalid continue token")
	}
	parts := strings.Split(string(decoded), "/")
	if len(parts) != 2 {
		return token, fmt.Errorf("invalid continue token")
	}
	token.Page, err = strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return token, fmt.Errorf("invalid continue token (page)")
	}
	token.Limit, err = strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return token, fmt.Errorf("invalid continue token")
	}
	return token, nil
}
