package recordingrule

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/convert"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/common"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/rules/legacy"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

var (
	_ grafanarest.Storage            = (*legacyStorage)(nil)
	_ dualwrite.DryRunUpdatePreparer = (*legacyStorage)(nil)
)

type legacyStorage struct {
	rules          *legacy.RecordingRules
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return ResourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true
}

func (s *legacyStorage) GetSingularName() string {
	return ResourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return ResourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	if _, err := request.NamespaceInfoFrom(ctx, true); err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	mode, ruleName, err := common.ParseListMode(opts.LabelSelector, opts.FieldSelector)
	if err != nil {
		return nil, k8serrors.NewBadRequest(err.Error())
	}
	switch mode {
	case common.ListModeHistory:
		out, err := s.rules.History(ctx, user, ruleName)
		if err != nil {
			if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
				return nil, k8serrors.NewNotFound(ResourceInfo.GroupResource(), ruleName)
			}
			return nil, err
		}
		return out, nil
	case common.ListModeTrash:
		return s.rules.Trash(ctx, user)
	case common.ListModeNormal:
		// fall through to the normal list pipeline below.
	}

	groupFilter, err := common.ParseLabelSelectorFilter(opts.LabelSelector, v1beta1.GroupLabelKey)
	if err != nil {
		return nil, k8serrors.NewBadRequest(fmt.Sprintf("invalid label selector for %s: %s", v1beta1.GroupLabelKey, err))
	}
	folderFilter, err := common.ParseLabelSelectorFilter(opts.LabelSelector, v1beta1.FolderLabelKey)
	if err != nil {
		return nil, k8serrors.NewBadRequest(fmt.Sprintf("invalid label selector for %s: %s", v1beta1.FolderLabelKey, err))
	}

	var (
		titleFilter               legacy.ListRuleStringFilter
		pausedFilter              legacy.ListRuleBoolFilter
		metricFilter              legacy.ListRuleStringFilter
		targetDatasourceUIDFilter legacy.ListRuleStringFilter
	)
	if opts.FieldSelector != nil && !opts.FieldSelector.Empty() {
		for _, r := range opts.FieldSelector.Requirements() {
			switch r.Field {
			case "spec.title":
				if err := common.ApplyFieldSelectorRequirement(&titleFilter, r, nil); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.paused":
				v, err := strconv.ParseBool(r.Value)
				if err != nil {
					return nil, k8serrors.NewBadRequest(fmt.Sprintf("invalid value for spec.paused: %s", r.Value))
				}
				switch r.Operator {
				case selection.Equals, selection.DoubleEquals:
					pausedFilter.Value = &v
				case selection.NotEquals:
					negated := !v
					pausedFilter.Value = &negated
				default:
					return nil, k8serrors.NewBadRequest(fmt.Sprintf("unsupported operator %q for spec.paused (only =, ==, != are supported)", r.Operator))
				}
			case "spec.metric":
				if err := common.ApplyFieldSelectorRequirement(&metricFilter, r, nil); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			case "spec.targetDatasourceUID":
				if err := common.ApplyFieldSelectorRequirement(&targetDatasourceUIDFilter, r, nil); err != nil {
					return nil, k8serrors.NewBadRequest(err.Error())
				}
			default:
				return nil, k8serrors.NewBadRequest(fmt.Sprintf("unknown field selector: %s", r.Field))
			}
		}
	}

	return s.rules.List(ctx, user, legacy.ListAlertRulesOptions{
		Limit:                     opts.Limit,
		ContinueToken:             opts.Continue,
		GroupFilter:               groupFilter,
		FolderFilter:              folderFilter,
		TitleFilter:               titleFilter,
		PausedFilter:              pausedFilter,
		MetricFilter:              metricFilter,
		TargetDatasourceUIDFilter: targetDatasourceUIDFilter,
	})
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	if _, err := request.NamespaceInfoFrom(ctx, true); err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	rule, err := s.rules.Get(ctx, user, name)
	if err != nil {
		if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
			return nil, k8serrors.NewNotFound(ResourceInfo.GroupResource(), name)
		}
		return nil, err
	}
	return rule, nil
}

func (s *legacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if _, err := request.NamespaceInfoFrom(ctx, true); err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	// The dual writer can pass the object in the version of the request.
	p, err := convert.Hub[*v1beta1.RecordingRule](obj)
	if err != nil {
		return nil, k8serrors.NewBadRequest("expected valid recording rule object")
	}

	if p.GenerateName != "" {
		return nil, k8serrors.NewBadRequest("generate-name is not supported in legacy storage mode")
	}
	// TODO: move this to the validation function
	if p.Labels[v1beta1.GroupLabelKey] != "" || p.Labels[v1beta1.GroupIndexLabelKey] != "" {
		return nil, k8serrors.NewBadRequest("cannot set group label when creating recording rule")
	}

	rule, err := s.rules.Create(ctx, user, p, options != nil && dryrun.IsDryRun(options.DryRun))
	if err != nil {
		return nil, common.ToAPIError(ResourceInfo.GroupResource(), p.GetName(), err)
	}
	return rule, nil
}

func (s *legacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, _ bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return common.LegacyRuleUpdate(
		ctx, name, objInfo, updateValidation, options != nil && dryrun.IsDryRun(options.DryRun),
		ResourceInfo, s.Get, s.rules.Update,
	)
}

func (s *legacyStorage) PrepareDryRunUpdate(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo) (runtime.Object, error) {
	return common.LegacyRulePrepareDryRunUpdate(ctx, name, objInfo, ResourceInfo, s.Get, s.rules.Update)
}

func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, opts *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if _, err := request.NamespaceInfoFrom(ctx, true); err != nil {
		return nil, false, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}
	if deleteValidation != nil {
		if err := deleteValidation(ctx, old); err != nil {
			return nil, false, err
		}
	}
	p, err := convert.Hub[*v1beta1.RecordingRule](old)
	if err != nil {
		return nil, false, k8serrors.NewBadRequest("expected valid recording rule object")
	}

	if err := s.rules.Delete(ctx, user, p, opts != nil && dryrun.IsDryRun(opts.DryRun)); err != nil {
		return old, false, common.ToAPIError(ResourceInfo.GroupResource(), name, err)
	}
	return old, false, nil
}

// DeleteCollection deletes the recording rules matched by listOptions in pages of common.DeleteCollectionPageSize. Each page
// is validated, authorized and deleted in its own transaction, so a page is deleted entirely or not at all. Like the
// upstream apiserver, a failure stops the call with the pages before it already deleted.
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	if _, err := request.NamespaceInfoFrom(ctx, true); err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	if listOptions == nil {
		listOptions = &internalversion.ListOptions{}
	}
	if err := common.ValidateDeleteCollectionRequest(listOptions); err != nil {
		return nil, err
	}

	opts := listOptions.DeepCopy()
	// remaining is how many more rules the caller's limit allows; 0 means no limit.
	remaining := opts.Limit
	deleted := &v1beta1.RecordingRuleList{Items: make([]v1beta1.RecordingRule, 0)}
	for {
		opts.Limit = common.DeleteCollectionPageSize
		if remaining > 0 && remaining < opts.Limit {
			opts.Limit = remaining
		}
		items, next, err := common.ListPage(ctx, s.List, opts)
		if err != nil {
			return nil, err
		}
		rules := make([]*v1beta1.RecordingRule, 0, len(items))
		page := make([]v1beta1.RecordingRule, 0, len(items))
		for _, item := range items {
			if deleteValidation != nil {
				if err := deleteValidation(ctx, item); err != nil {
					return nil, err
				}
			}
			// The items come from our own List, so a conversion failure is a server error, not a bad request.
			rule, err := convert.Hub[*v1beta1.RecordingRule](item)
			if err != nil {
				return nil, k8serrors.NewInternalError(fmt.Errorf("failed to convert rule %q: %w", common.ObjectName(item), err))
			}
			rules = append(rules, rule)
			page = append(page, *rule)
		}
		if err := s.rules.DeleteMany(ctx, user, rules, options != nil && dryrun.IsDryRun(options.DryRun)); err != nil {
			return nil, err
		}
		deleted.Items = append(deleted.Items, page...)

		if remaining > 0 {
			remaining -= int64(len(items))
			if remaining <= 0 {
				deleted.Continue = next
				return deleted, nil
			}
		}
		if next == "" {
			return deleted, nil
		}
		opts.Continue = next
	}
}
