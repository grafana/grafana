package sso

import (
	"context"
	"fmt"
	"hash/fnv"
	"net/http"
	"sort"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
)

var (
	_ rest.Storage              = (*MTSettingsStore)(nil)
	_ rest.Scoper               = (*MTSettingsStore)(nil)
	_ rest.Getter               = (*MTSettingsStore)(nil)
	_ rest.Lister               = (*MTSettingsStore)(nil)
	_ rest.Creater              = (*MTSettingsStore)(nil)
	_ rest.Updater              = (*MTSettingsStore)(nil)
	_ rest.SingularNameProvider = (*MTSettingsStore)(nil)
	_ rest.GracefulDeleter      = (*MTSettingsStore)(nil)
)

// MTSettingsStore backs the SSOSetting kind with MT-Settings: a provider's blob
// maps to per-key Setting rows under the auth.<provider> section. Source-layer
// precedence and secret encrypt/decrypt are handled server-side.
type MTSettingsStore struct {
	reader settingsvc.Service
	writer settingsvc.Writer
}

func NewMTSettingsStore(reader settingsvc.Service, writer settingsvc.Writer) *MTSettingsStore {
	return &MTSettingsStore{reader: reader, writer: writer}
}

// Destroy implements rest.Storage.
func (s *MTSettingsStore) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *MTSettingsStore) NamespaceScoped() bool {
	return true
}

// GetSingularName implements rest.SingularNameProvider.
func (s *MTSettingsStore) GetSingularName() string {
	return resource.GetSingularName()
}

// New implements rest.Storage.
func (s *MTSettingsStore) New() runtime.Object {
	return resource.NewFunc()
}

// NewList implements rest.Lister.
func (s *MTSettingsStore) NewList() runtime.Object {
	return resource.NewListFunc()
}

// ConvertToTable implements rest.Lister.
func (s *MTSettingsStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return resource.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

// Get reassembles the provider's SSOSetting from its (source-resolved) rows.
func (s *MTSettingsStore) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	if s.reader == nil {
		return nil, s.notImplemented("get", name)
	}
	rows, err := s.reader.List(ctx, sectionSelector(name))
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}
	if len(rows) == 0 {
		return nil, resource.NewNotFound(name)
	}
	return rowsToSSOSetting(ctx, name, rows), nil
}

// Create implements rest.Creater. It writes each key of the blob as a per-key
// row under auth.<provider>. Secret classification/encryption is the settings
// service mutator's job.
func (s *MTSettingsStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	if s.reader == nil || s.writer == nil {
		return nil, s.notImplemented("create", "")
	}
	ssoSetting, ok := obj.(*iamv0.SSOSetting)
	if !ok {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected an SSOSetting object, got %T", obj))
	}
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	section := sectionFor(ssoSetting.Name)
	desired := ssoSetting.Spec.Settings.UnstructuredContent()
	for key, val := range desired {
		if err := s.writer.Upsert(ctx, &settingsvc.Setting{Section: section, Key: key, Value: valueToString(val)}); err != nil {
			return nil, apierrors.NewInternalError(err)
		}
	}

	// Re-read so the response is the stored projection, not an echo of the
	// request (which omits default-layer keys and never sets Spec.Source).
	return s.Get(ctx, ssoSetting.Name, &metav1.GetOptions{})
}

// List implements rest.Lister.
func (s *MTSettingsStore) List(_ context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	return nil, s.notImplemented("list", "")
}

// Update implements rest.Updater with the desired-state reconcile: upsert every
// desired key FIRST, then delete stale us-layer rows LAST, failing loud on any
// error. Ordering guarantees a required value is never absent (worst case is a
// recoverable duplicate), and re-applying the same blob converges. Validation
// (e.g. "exactly one" mutually-exclusive variant) is enforced upstream, not here.
func (s *MTSettingsStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if s.reader == nil || s.writer == nil {
		return nil, false, s.notImplemented("update", name)
	}

	var oldObj runtime.Object
	current, err := s.Get(ctx, name, &metav1.GetOptions{})
	switch {
	case err == nil:
		oldObj = current
	case apierrors.IsNotFound(err) && !forceAllowCreate:
		return nil, false, err
	case apierrors.IsNotFound(err):
		// create-on-update: oldObj stays nil
	default:
		return nil, false, err
	}

	newObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, err
	}
	ssoSetting, ok := newObj.(*iamv0.SSOSetting)
	if !ok {
		return nil, false, apierrors.NewBadRequest(fmt.Sprintf("expected an SSOSetting object, got %T", newObj))
	}

	created := oldObj == nil
	if created {
		if createValidation != nil {
			if err := createValidation(ctx, newObj); err != nil {
				return nil, false, err
			}
		}
	} else if updateValidation != nil {
		if err := updateValidation(ctx, newObj, oldObj); err != nil {
			return nil, false, err
		}
	}

	section := sectionFor(name)
	desired := ssoSetting.Spec.Settings.UnstructuredContent()

	// Upsert every desired key first — a required value is never removed before
	// its replacement is durable.
	for key, val := range desired {
		if err := s.writer.Upsert(ctx, &settingsvc.Setting{Section: section, Key: key, Value: valueToString(val)}); err != nil {
			return nil, false, apierrors.NewInternalError(err)
		}
	}

	// Prune stale us-layer rows last: any us row whose key is not in the desired
	// blob. defaults/hgapi layers are not ours to touch.
	existing, err := s.reader.List(ctx, sectionSelector(name))
	if err != nil {
		return nil, false, apierrors.NewInternalError(err)
	}
	for _, row := range existing {
		if row.Labels["source"] != "us" {
			continue
		}
		if _, keep := desired[row.Key]; !keep {
			if err := s.writer.Delete(ctx, section, row.Key); err != nil {
				return nil, false, apierrors.NewInternalError(err)
			}
		}
	}

	updated, err := s.Get(ctx, name, &metav1.GetOptions{})
	return updated, created, err
}

// Delete implements rest.GracefulDeleter. It removes the provider's us-layer
// rows (defaults/hgapi remain server-side); the provider then resolves to its
// system defaults.
func (s *MTSettingsStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if s.reader == nil || s.writer == nil {
		return nil, false, s.notImplemented("delete", name)
	}
	current, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	if deleteValidation != nil {
		if err := deleteValidation(ctx, current); err != nil {
			return nil, false, err
		}
	}

	rows, err := s.reader.List(ctx, sectionSelector(name))
	if err != nil {
		return nil, false, apierrors.NewInternalError(err)
	}
	section := sectionFor(name)
	for _, row := range rows {
		if row.Labels["source"] != "us" {
			continue
		}
		if err := s.writer.Delete(ctx, section, row.Key); err != nil {
			return nil, false, apierrors.NewInternalError(err)
		}
	}
	// NOTE: returns the pre-delete object. Removing the us override leaves any
	// defaults/hgapi rows, so the provider does not truly vanish; the accurate
	// post-delete semantics are mode-dependent (which store is read-authoritative)
	// and are settled in the migration's later choreography stage.
	return current, true, nil
}

func (s *MTSettingsStore) notImplemented(verb string, name string) error {
	return apierrors.NewGenericServerResponse(http.StatusNotImplemented, verb, resource.GroupResource(), name,
		"MT-Settings storage for SSO settings is not implemented yet", 0, false)
}

// sectionFor returns the settings section for a provider (e.g. saml -> auth.saml).
func sectionFor(provider string) string { return "auth." + provider }

func sectionSelector(provider string) metav1.LabelSelector {
	return metav1.LabelSelector{MatchLabels: map[string]string{"section": sectionFor(provider)}}
}

func ssoTypeMeta() metav1.TypeMeta {
	return metav1.TypeMeta{Kind: "SSOSetting", APIVersion: resource.GroupVersion().String()}
}

// rowsToSSOSetting assembles a provider's rows into an SSOSetting blob. The rows
// are already source-resolved by the settings service; source=us on any row
// means the provider carries an admin override (db), otherwise it is system.
func rowsToSSOSetting(ctx context.Context, provider string, rows []*settingsvc.Setting) *iamv0.SSOSetting {
	settings := make(map[string]any, len(rows))
	source := iamv0.SourceSystem
	for _, r := range rows {
		settings[r.Key] = r.Value
		if r.Labels["source"] == "us" {
			source = iamv0.SourceDB
		}
	}
	return &iamv0.SSOSetting{
		TypeMeta: ssoTypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:            provider,
			Namespace:       genericapirequest.NamespaceValue(ctx),
			ResourceVersion: coarseResourceVersion(settings),
		},
		Spec: iamv0.SSOSettingSpec{
			Source:   source,
			Settings: common.Unstructured{Object: settings},
		},
	}
}

// coarseResourceVersion derives a content-hash resourceVersion. SSO settings use
// last-write-wins (no strict multi-row concurrency), so this is for protocol
// compliance and change detection, not conflict enforcement.
func coarseResourceVersion(settings map[string]any) string {
	keys := make([]string, 0, len(settings))
	for k := range settings {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	h := fnv.New64a()
	for _, k := range keys {
		_, _ = fmt.Fprintf(h, "%s=%v\n", k, settings[k])
	}
	return strconv.FormatUint(h.Sum64(), 10)
}

func valueToString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}
