package appsettings

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"

	"github.com/grafana/grafana-app-sdk/resource"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

// legacyPluginSecureValueNamePrefix identifies secure value names generated from
// legacy plugin settings stored in SQL. Must not be used when saving to unified storage.
const legacyPluginSecureValueNamePrefix = "lps-sv-"

// getLegacySecureValueName produces a deterministic, opaque reference name for a
// legacy plugin setting secure field, mirroring the datasource converter pattern.
func getLegacySecureValueName(pluginID string, key string) string {
	h := sha256.New()
	h.Write([]byte(pluginID))
	h.Write([]byte("|"))
	h.Write([]byte(key))
	return legacyPluginSecureValueNamePrefix + hex.EncodeToString(h.Sum(nil))
}

func getLegacySettingsUID(orgID int64, pluginID string) types.UID {
	h := sha256.New()
	h.Write([]byte(strconv.FormatInt(orgID, 10)))
	h.Write([]byte("|"))
	h.Write([]byte(pluginID))
	return types.UID("lps-uid-" + hex.EncodeToString(h.Sum(nil)))
}

func getLegacySettingsResourceVersion(ps *pluginsettings.DTO) string {
	if ps == nil || ps.Updated.IsZero() {
		return "0"
	}
	return strconv.FormatInt(ps.Updated.UnixMilli(), 10)
}

// toSecureJSONData translates InlineSecureValues from a write request into the
// plaintext map expected by UpdateArgs. Name-only entries (keep-existing) are skipped.
func toSecureJSONData(secure resource.InlineSecureValues) map[string]string {
	if len(secure) == 0 {
		return nil
	}
	result := map[string]string{}
	for k, v := range secure {
		if !v.Create.IsZero() {
			result[k] = v.Create.DangerouslyExposeAndConsumeValue()
		}
		if v.Remove {
			result[k] = "" // best effort with the legacy API
		}
	}
	return result
}

// LegacySettingsReader is the read side of [pluginsettings.Service]. A reader
// that is not tenant-scoped by org ID can take the namespace from the context.
type LegacySettingsReader interface {
	GetPluginSettingByPluginID(ctx context.Context, args *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error)
	DecryptedValues(ps *pluginsettings.DTO) map[string]string
}

type legacySettingsWriter interface {
	UpdatePluginSetting(ctx context.Context, args *pluginsettings.UpdateArgs) error
}

type settingsStorage struct {
	pluginID string
	// pluginSettings also implements legacySettingsWriter unless the store is read-only.
	pluginSettings LegacySettingsReader // TODO we may need a caching version
	resourceInfo   *utils.ResourceInfo
}

func NewLegacySettingsStore(group string, pluginID string, pluginSettings pluginsettings.Service) grafanarest.Storage {
	return newLegacySettingsStore(group, pluginID, pluginSettings)
}

// NewReadOnlyLegacySettingsStore serves the same objects as NewLegacySettingsStore
// from a reader that has no write path; writes return MethodNotSupported.
func NewReadOnlyLegacySettingsStore(pluginID string, reader LegacySettingsReader) grafanarest.Storage {
	// Hide any write method the reader's concrete type has.
	return newLegacySettingsStore(pluginID, pluginID, struct{ LegacySettingsReader }{reader})
}

func newLegacySettingsStore(group string, pluginID string, reader LegacySettingsReader) *settingsStorage {
	settingsRI := apppluginV0.SettingsResourceInfo.WithGroupAndShortName(
		group, pluginID,
	)
	return &settingsStorage{
		pluginID:       pluginID,
		pluginSettings: reader,
		resourceInfo:   &settingsRI,
	}
}

var _ grafanarest.Storage = (*settingsStorage)(nil)

func (s *settingsStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *settingsStorage) Destroy() {}

func (s *settingsStorage) NamespaceScoped() bool {
	return true
}

func (s *settingsStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *settingsStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *settingsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.resourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *settingsStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	if name != apppluginV0.INSTANCE_NAME {
		return nil, apierrors.NewNotFound(s.resourceInfo.GroupResource(), name)
	}
	return s.get(ctx)
}

func (s *settingsStorage) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	if opts != nil && opts.Continue != "" {
		return nil, apierrors.NewBadRequest("continue is not supported for singleton settings")
	}
	if opts != nil && opts.FieldSelector != nil {
		for _, req := range opts.FieldSelector.Requirements() {
			if req.Field != "metadata.name" && req.Field != "metadata.namespace" {
				return nil, apierrors.NewBadRequest(fmt.Sprintf("field selector %q is not supported", req.Field))
			}
		}
	}
	obj, err := s.get(ctx)
	if err != nil {
		return nil, err
	}
	out := &apppluginV0.SettingsList{
		ListMeta: metav1.ListMeta{ResourceVersion: obj.ResourceVersion},
		Items:    []apppluginV0.Settings{},
	}
	if opts != nil {
		if opts.LabelSelector != nil && !opts.LabelSelector.Matches(labels.Set(obj.Labels)) {
			return out, nil
		}
		if opts.FieldSelector != nil && !opts.FieldSelector.Matches(fields.Set{"metadata.name": obj.Name, "metadata.namespace": obj.Namespace}) {
			return out, nil
		}
	}
	out.Items = append(out.Items, *obj)
	return out, nil
}

func (s *settingsStorage) get(ctx context.Context) (*apppluginV0.Settings, error) {
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	obj := &apppluginV0.Settings{
		ObjectMeta: metav1.ObjectMeta{
			Name:            apppluginV0.INSTANCE_NAME,
			Namespace:       nsInfo.Value,
			UID:             getLegacySettingsUID(nsInfo.OrgID, s.pluginID),
			ResourceVersion: getLegacySettingsResourceVersion(nil),
		},
	}

	ps, err := s.pluginSettings.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		PluginID: s.pluginID,
		OrgID:    nsInfo.OrgID,
	})
	if err != nil && !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
		// The apiserver reads status only from an unwrapped APIStatus error.
		if _, ok := err.(apierrors.APIStatus); ok {
			return nil, err
		}
		return nil, fmt.Errorf("failed to get plugin settings: %w", err)
	}
	if ps != nil {
		pluginsettings.WithDecryptedValues(ctx, func(ctx context.Context) (map[string]string, error) {
			return s.pluginSettings.DecryptedValues(ps), nil
		})

		obj.SetCreationTimestamp(metav1.NewTime(ps.Updated))
		obj.SetResourceVersion(getLegacySettingsResourceVersion(ps))

		obj.Spec.Enabled = ps.Enabled
		obj.Spec.Pinned = ps.Pinned
		obj.Spec.JsonData = common.Unstructured{Object: ps.JSONData}

		secureValues := make(resource.InlineSecureValues, len(ps.SecureJSONData))
		for k, v := range ps.SecureJSONData {
			if len(v) > 0 {
				secureValues[k] = resource.InlineSecureValue{Name: getLegacySecureValueName(s.pluginID, k)}
			}
		}
		obj.Secure = secureValues
	}
	return obj, nil
}

func (s *settingsStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}
	isDryRun := options != nil && dryrun.IsDryRun(options.DryRun)
	return s.save(ctx, obj, isDryRun)
}

func (s *settingsStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, _ bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if _, err := s.writer(); err != nil {
		return nil, false, err
	}
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return nil, false, err
	}

	updated, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}

	if updateValidation != nil {
		if err := updateValidation(ctx, updated, old); err != nil {
			return nil, false, err
		}
	}

	isDryRun := options != nil && dryrun.IsDryRun(options.DryRun)
	obj, err := s.save(ctx, updated, isDryRun)
	return obj, false, err
}

func (s *settingsStorage) Delete(_ context.Context, _ string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, apierrors.NewMethodNotSupported(s.resourceInfo.GroupResource(), "delete")
}

func (s *settingsStorage) DeleteCollection(_ context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(s.resourceInfo.GroupResource(), "deletecollection")
}

func (s *settingsStorage) writer() (legacySettingsWriter, error) {
	if w, ok := s.pluginSettings.(legacySettingsWriter); ok {
		return w, nil
	}
	return nil, apierrors.NewMethodNotSupported(s.resourceInfo.GroupResource(), "update")
}

func (s *settingsStorage) save(ctx context.Context, obj runtime.Object, isDryRun bool) (*apppluginV0.Settings, error) {
	p, ok := obj.(*apppluginV0.Settings)
	if !ok {
		return nil, fmt.Errorf("expected Settings object")
	}

	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	writer, err := s.writer()
	if err != nil {
		return nil, err
	}

	if isDryRun {
		return p, nil
	}

	if err := writer.UpdatePluginSetting(ctx, &pluginsettings.UpdateArgs{
		PluginID:       s.pluginID,
		OrgID:          nsInfo.OrgID,
		Enabled:        p.Spec.Enabled,
		Pinned:         p.Spec.Pinned,
		JSONData:       p.Spec.JsonData.Object,
		SecureJSONData: toSecureJSONData(p.Secure),
	}); err != nil {
		if errors.Is(err, pluginsettings.ErrPluginSettingDataTooLarge) {
			return nil, apierrors.NewBadRequest(err.Error())
		}
		return nil, fmt.Errorf("failed to save plugin settings: %w", err)
	}
	return s.get(ctx)
}
