package receiver

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/alerting/receivers/schema"

	alertingNotify "github.com/grafana/alerting/notify"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// integrationVersion resolves a real schema version for the given integration type, the
// same lookup conversions.go performs, so tests exercise the actual CanCreate values
// shipped in the pinned github.com/grafana/alerting version rather than a hand-rolled
// stand-in.
func integrationVersion(t *testing.T, integrationType string, v schema.Version) schema.IntegrationSchemaVersion {
	t.Helper()
	typeSchema, ok := alertingNotify.GetSchemaForIntegration(schema.IntegrationType(integrationType))
	require.True(t, ok, "%s integration schema must exist", integrationType)
	version, ok := typeSchema.GetVersion(v)
	require.True(t, ok, "version %s must exist for %s", v, integrationType)
	return version
}

func webhookVersion(t *testing.T, v schema.Version) schema.IntegrationSchemaVersion {
	t.Helper()
	return integrationVersion(t, "webhook", v)
}

func TestRejectNonCreatableVersions(t *testing.T) {
	legacy := webhookVersion(t, schema.V0mimir1)
	require.False(t, legacy.CanCreate, "test assumes webhook v0mimir1 is not user-creatable")
	current := webhookVersion(t, schema.V1)
	require.True(t, current.CanCreate, "test assumes webhook v1 is user-creatable")

	t.Run("rejects a legacy version", func(t *testing.T) {
		err := rejectNonCreatableVersions([]*ngmodels.Integration{{UID: "i1", Config: legacy}})
		require.Error(t, err)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		assert.Equal(t, int32(400), statusErr.Status().Code)
	})

	t.Run("allows a creatable version", func(t *testing.T) {
		err := rejectNonCreatableVersions([]*ngmodels.Integration{{UID: "i1", Config: current}})
		require.NoError(t, err)
	})
}

func TestRejectNonCreatableVersionChanges(t *testing.T) {
	legacy := webhookVersion(t, schema.V0mimir1)
	current := webhookVersion(t, schema.V1)

	t.Run("rejects a brand new integration on a legacy version", func(t *testing.T) {
		err := rejectNonCreatableVersionChanges(
			[]*ngmodels.Integration{{UID: "new", Config: legacy}},
			nil,
		)
		require.Error(t, err)
	})

	t.Run("rejects downgrading an existing integration to a legacy version", func(t *testing.T) {
		existingUID := "int-1"
		err := rejectNonCreatableVersionChanges(
			[]*ngmodels.Integration{{UID: existingUID, Config: legacy}},
			[]model.ReceiverIntegration{{Uid: &existingUID, Type: "webhook", Version: string(schema.V1)}},
		)
		require.Error(t, err)
	})

	t.Run("allows an existing integration whose legacy version is unchanged", func(t *testing.T) {
		existingUID := "int-1"
		err := rejectNonCreatableVersionChanges(
			[]*ngmodels.Integration{{UID: existingUID, Config: legacy}},
			[]model.ReceiverIntegration{{Uid: &existingUID, Type: "webhook", Version: string(schema.V0mimir1)}},
		)
		require.NoError(t, err, "a receiver already legitimately on a legacy version (e.g. promoted from a Mimir import) must stay editable")
	})

	t.Run("allows a creatable version regardless of prior state", func(t *testing.T) {
		err := rejectNonCreatableVersionChanges(
			[]*ngmodels.Integration{{UID: "new", Config: current}},
			nil,
		)
		require.NoError(t, err)
	})

	t.Run("rejects a type change that reuses the same legacy version label under a new UID-matched type", func(t *testing.T) {
		// webhook and email both have a v0mimir1 (CanCreate=false) version. Swapping an
		// existing UID's declared type from webhook to email, while keeping the version
		// string "v0mimir1" the same, must not be waved through as "unchanged" -- schema
		// versions are only meaningful within their own type.
		existingUID := "int-1"
		emailLegacy := integrationVersion(t, "email", schema.V0mimir1)
		err := rejectNonCreatableVersionChanges(
			[]*ngmodels.Integration{{UID: existingUID, Config: emailLegacy}},
			[]model.ReceiverIntegration{{Uid: &existingUID, Type: "webhook", Version: string(schema.V0mimir1)}},
		)
		require.Error(t, err)
	})
}

// fakeReceiverService is a minimal ReceiverService double. Only the methods exercised by
// the tests below do anything; the rest satisfy the interface.
type fakeReceiverService struct {
	getReceiver    *ngmodels.Receiver
	createCalled   bool
	updateCalled   bool
	updateReceiver *ngmodels.Receiver
	createReceiver *ngmodels.Receiver
}

func (f *fakeReceiverService) GetReceiver(_ context.Context, _ string, _ bool, _ identity.Requester) (*ngmodels.Receiver, error) {
	return f.getReceiver, nil
}

func (f *fakeReceiverService) GetReceivers(_ context.Context, _ ngmodels.GetReceiversQuery, _ identity.Requester) ([]*ngmodels.Receiver, error) {
	return nil, nil
}

func (f *fakeReceiverService) CreateReceiver(_ context.Context, r *ngmodels.Receiver, _ int64, _ identity.Requester) (*ngmodels.Receiver, error) {
	f.createCalled = true
	f.createReceiver = r
	return r, nil
}

func (f *fakeReceiverService) UpdateReceiver(_ context.Context, r *ngmodels.Receiver, _ map[string][]string, _ int64, _ identity.Requester) (*ngmodels.Receiver, error) {
	f.updateCalled = true
	f.updateReceiver = r
	return r, nil
}

func (f *fakeReceiverService) DeleteReceiver(_ context.Context, _ string, _ ngmodels.Provenance, _ string, _ int64, _ identity.Requester) error {
	return nil
}

type fakeMetadataService struct{}

func (fakeMetadataService) AccessControlMetadata(_ context.Context, _ identity.Requester, _ ...*ngmodels.Receiver) (map[string]ngmodels.ReceiverPermissionSet, error) {
	return nil, nil
}

func (fakeMetadataService) InUseMetadata(_ context.Context, _ int64, _ ...*ngmodels.Receiver) (map[string]ngmodels.ReceiverMetadata, error) {
	return nil, nil
}

func newTestReceiverStorage(svc *fakeReceiverService) *legacyStorage {
	return &legacyStorage{
		service:    svc,
		namespacer: request.GetNamespaceMapper(&setting.Cfg{}),
		metadata:   fakeMetadataService{},
	}
}

func testCtx() context.Context {
	ctx := genericapirequest.WithNamespace(context.Background(), "default")
	return identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserUID: "test-user"})
}

func TestLegacyStorage_Create_RejectsLegacyVersion(t *testing.T) {
	svc := &fakeReceiverService{}
	s := newTestReceiverStorage(svc)

	receiverObj := &model.Receiver{
		Spec: model.ReceiverSpec{
			Title: "my-receiver",
			Integrations: []model.ReceiverIntegration{
				{Type: "webhook", Version: string(schema.V0mimir1), Settings: map[string]any{"url": "http://example.com"}},
			},
		},
	}

	_, err := s.Create(testCtx(), receiverObj, nil, nil)
	require.Error(t, err)
	assert.False(t, svc.createCalled, "CreateReceiver must not be called when a version is rejected")
}

func TestLegacyStorage_Create_AllowsCurrentVersion(t *testing.T) {
	svc := &fakeReceiverService{}
	s := newTestReceiverStorage(svc)

	receiverObj := &model.Receiver{
		Spec: model.ReceiverSpec{
			Title: "my-receiver",
			Integrations: []model.ReceiverIntegration{
				{Type: "webhook", Version: string(schema.V1), Settings: map[string]any{"url": "http://example.com"}},
			},
		},
	}

	_, err := s.Create(testCtx(), receiverObj, nil, nil)
	require.NoError(t, err)
	assert.True(t, svc.createCalled)
}

func TestLegacyStorage_Update_RejectsDowngradeToLegacyVersion(t *testing.T) {
	existingUID := "int-1"
	svc := &fakeReceiverService{
		getReceiver: &ngmodels.Receiver{
			UID:  "recv-1",
			Name: "my-receiver",
			Integrations: []*ngmodels.Integration{
				{UID: existingUID, Name: "my-receiver", Config: webhookVersion(t, schema.V1)},
			},
		},
	}
	s := newTestReceiverStorage(svc)

	updated := &model.Receiver{
		Spec: model.ReceiverSpec{
			Title: "my-receiver",
			Integrations: []model.ReceiverIntegration{
				{Uid: &existingUID, Type: "webhook", Version: string(schema.V0mimir1), Settings: map[string]any{"url": "http://example.com"}},
			},
		},
	}

	_, _, err := s.Update(testCtx(), "recv-1", rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, nil)
	require.Error(t, err)
	assert.False(t, svc.updateCalled, "UpdateReceiver must not be called when a version downgrade is rejected")
}

func TestLegacyStorage_Update_AllowsUnchangedLegacyVersion(t *testing.T) {
	existingUID := "int-1"
	svc := &fakeReceiverService{
		getReceiver: &ngmodels.Receiver{
			UID:  "recv-1",
			Name: "my-receiver",
			Integrations: []*ngmodels.Integration{
				{UID: existingUID, Name: "my-receiver", Config: webhookVersion(t, schema.V0mimir1)},
			},
		},
	}
	s := newTestReceiverStorage(svc)

	updated := &model.Receiver{
		Spec: model.ReceiverSpec{
			Title: "my-receiver-renamed",
			Integrations: []model.ReceiverIntegration{
				{Uid: &existingUID, Type: "webhook", Version: string(schema.V0mimir1), Settings: map[string]any{"url": "http://example.com"}},
			},
		},
	}

	_, _, err := s.Update(testCtx(), "recv-1", rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, nil)
	require.NoError(t, err, "an integration already legitimately on a legacy version must remain editable when its version doesn't change")
	assert.True(t, svc.updateCalled)
}

func TestLegacyStorage_Update_RejectsNewIntegrationOnLegacyVersion(t *testing.T) {
	existingUID := "int-1"
	svc := &fakeReceiverService{
		getReceiver: &ngmodels.Receiver{
			UID:  "recv-1",
			Name: "my-receiver",
			Integrations: []*ngmodels.Integration{
				{UID: existingUID, Name: "my-receiver", Config: webhookVersion(t, schema.V1)},
			},
		},
	}
	s := newTestReceiverStorage(svc)

	updated := &model.Receiver{
		Spec: model.ReceiverSpec{
			Title: "my-receiver",
			Integrations: []model.ReceiverIntegration{
				{Uid: &existingUID, Type: "webhook", Version: string(schema.V1), Settings: map[string]any{"url": "http://example.com"}},
				{Type: "webhook", Version: string(schema.V0mimir1), Settings: map[string]any{"url": "http://example.com/2"}},
			},
		},
	}

	_, _, err := s.Update(testCtx(), "recv-1", rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, nil)
	require.Error(t, err)
	assert.False(t, svc.updateCalled)
}
