package notifier

import (
	"context"
	"errors"
	"math/rand"
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingmodels "github.com/grafana/alerting/models"

	ngfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
)

func TestWithAccessControlMetadata(t *testing.T) {
	user := ac.BackgroundUser("test", 1, org.RoleNone, nil)
	silencesWithMetadata := []*models.SilenceWithMetadata{
		{Silence: util.Pointer(models.SilenceGen()())},
		{Silence: util.Pointer(models.SilenceGen()())},
		{Silence: util.Pointer(models.SilenceGen()())},
	}
	randPerm := func() models.SilencePermissionSet {
		return models.SilencePermissionSet{
			models.SilencePermissionRead:   rand.Intn(2) == 1,
			models.SilencePermissionWrite:  rand.Intn(2) == 1,
			models.SilencePermissionCreate: rand.Intn(2) == 1,
		}
	}
	t.Run("Attach permissions to silences", func(t *testing.T) {
		authz := fakes.FakeSilenceService{}
		response := map[*models.Silence]models.SilencePermissionSet{
			silencesWithMetadata[0].Silence: randPerm(),
			silencesWithMetadata[1].Silence: randPerm(),
			silencesWithMetadata[2].Silence: randPerm(),
		}
		authz.SilenceAccessFunc = func(ctx context.Context, user identity.Requester, silences []*models.Silence) (map[*models.Silence]models.SilencePermissionSet, error) {
			return response, nil
		}
		svc := SilenceService{
			authz: &authz,
		}

		require.NoError(t, svc.WithAccessControlMetadata(context.Background(), user, silencesWithMetadata...))
		for _, silence := range silencesWithMetadata {
			assert.Equal(t, response[silence.Silence], *silence.Metadata.Permissions)
		}
	})
}

func TestWithRuleMetadata(t *testing.T) {
	user := ac.BackgroundUser("test", 1, org.RoleNone, nil)
	t.Run("Attach rule metadata to silences", func(t *testing.T) {
		ruleAuthz := fakes.FakeRuleService{}
		ruleAuthz.HasAccessInFolderFunc = func(ctx context.Context, user identity.Requester, silence models.Namespaced) (bool, error) {
			return true, nil
		}

		rules := []*models.AlertRule{
			{UID: "rule1", NamespaceUID: "folder1"},
			{UID: "rule2", NamespaceUID: "folder2"},
			{UID: "rule3", NamespaceUID: "folder3"},
		}
		ruleStore := ngfakes.NewRuleStore(t)
		ruleStore.Rules[1] = rules
		svc := SilenceService{
			ruleAuthz: &ruleAuthz,
			ruleStore: ruleStore,
		}

		silencesWithMetadata := []*models.SilenceWithMetadata{
			{Silence: util.Pointer(models.SilenceGen(models.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "rule1", labels.MatchEqual))())},
			{Silence: util.Pointer(models.SilenceGen(models.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "rule2", labels.MatchEqual))())},
			{Silence: util.Pointer(models.SilenceGen(models.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "rule3", labels.MatchEqual))())},
		}

		require.NoError(t, svc.WithRuleMetadata(context.Background(), user, silencesWithMetadata...))
		for i, silence := range silencesWithMetadata {
			metadata := &models.SilenceRuleMetadata{
				RuleUID:   rules[i].UID,
				RuleTitle: rules[i].Title,
				FolderUID: rules[i].NamespaceUID,
			}
			assert.Equal(t, silence.Metadata, models.SilenceMetadata{RuleMetadata: metadata})
		}
	})
	t.Run("Don't attach full rule metadata if no access or global", func(t *testing.T) {
		ruleAuthz := fakes.FakeRuleService{}
		ruleAuthz.HasAccessInFolderFunc = func(ctx context.Context, user identity.Requester, silence models.Namespaced) (bool, error) {
			return silence.GetNamespaceUID() == "folder1", nil
		}

		rules := []*models.AlertRule{
			{UID: "rule1", NamespaceUID: "folder1"},
			{UID: "rule2", NamespaceUID: "folder2"},
			{UID: "rule3", NamespaceUID: "folder3"},
		}
		ruleStore := ngfakes.NewRuleStore(t)
		ruleStore.Rules[1] = rules
		svc := SilenceService{
			ruleAuthz: &ruleAuthz,
			ruleStore: ruleStore,
		}

		silencesWithMetadata := []*models.SilenceWithMetadata{
			{Silence: util.Pointer(models.SilenceGen(models.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "rule1", labels.MatchEqual))())},
			{Silence: util.Pointer(models.SilenceGen(models.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "rule2", labels.MatchEqual))())},
			{Silence: util.Pointer(models.SilenceGen(models.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "rule3", labels.MatchEqual))())},
			{Silence: util.Pointer(models.SilenceGen()())},
		}

		require.NoError(t, svc.WithRuleMetadata(context.Background(), user, silencesWithMetadata...))
		assert.Equal(t, silencesWithMetadata[0].Metadata, models.SilenceMetadata{RuleMetadata: &models.SilenceRuleMetadata{ // Attach all metadata.
			RuleUID:   rules[0].UID,
			RuleTitle: rules[0].Title,
			FolderUID: rules[0].NamespaceUID,
		}})
		assert.Equal(t, silencesWithMetadata[1].Metadata, models.SilenceMetadata{RuleMetadata: &models.SilenceRuleMetadata{ // Attach metadata with rule UID regardless of access.
			RuleUID: rules[1].UID,
		}})
		assert.Equal(t, silencesWithMetadata[2].Metadata, models.SilenceMetadata{RuleMetadata: &models.SilenceRuleMetadata{ // Attach metadata with rule UID regardless of access.
			RuleUID: rules[2].UID,
		}})
		assert.Equal(t, silencesWithMetadata[3].Metadata, models.SilenceMetadata{}) // Global silence, no rule metadata.
	})
	t.Run("Don't check same namespace access more than once", func(t *testing.T) {
		ruleAuthz := fakes.FakeRuleService{}
		ruleAuthz.HasAccessInFolderFunc = func(ctx context.Context, user identity.Requester, silence models.Namespaced) (bool, error) {
			return true, nil
		}

		rules := []*models.AlertRule{
			{UID: "rule1", NamespaceUID: "folder1"},
			{UID: "rule2", NamespaceUID: "folder1"},
			{UID: "rule3", NamespaceUID: "folder1"},
		}
		ruleStore := ngfakes.NewRuleStore(t)
		ruleStore.Rules[1] = rules
		svc := SilenceService{
			ruleAuthz: &ruleAuthz,
			ruleStore: ruleStore,
		}

		silencesWithMetadata := []*models.SilenceWithMetadata{
			{Silence: util.Pointer(models.SilenceGen(models.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "rule1", labels.MatchEqual))())},
			{Silence: util.Pointer(models.SilenceGen(models.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "rule2", labels.MatchEqual))())},
			{Silence: util.Pointer(models.SilenceGen(models.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "rule3", labels.MatchEqual))())},
		}

		require.NoError(t, svc.WithRuleMetadata(context.Background(), user, silencesWithMetadata...))
		assert.Lenf(t, ruleAuthz.Calls, 1, "HasAccessInFolder should be called only once per namespace")
		assert.Equal(t, "HasAccessInFolder", ruleAuthz.Calls[0].MethodName)
		assert.Equal(t, "folder1", ruleAuthz.Calls[0].Arguments[2].(models.Namespaced).GetNamespaceUID())
	})
}

func TestUpdateSilence(t *testing.T) {
	user := ac.BackgroundUser("test", 1, org.RoleNone, nil)
	testCases := []struct {
		name        string
		existing    func() models.Silence
		mutators    []models.Mutator[models.Silence]
		errContains string
	}{
		{
			name:     "Updates to general silences allowed",
			existing: models.SilenceGen(),
			mutators: []models.Mutator[models.Silence]{
				models.SilenceMuts.Expired(),
			},
			errContains: "", // No Error.
		},
		{
			name:     "Updates to general silences that add rule_uid matcher error",
			existing: models.SilenceGen(),
			mutators: []models.Mutator[models.Silence]{
				models.SilenceMuts.WithRuleUID("rule1"),
			},
			errContains: alertingmodels.RuleUIDLabel, // Mention matcher in error message.
		},
		{
			name:     "Updates that change rule_uid matcher error",
			existing: models.SilenceGen(models.SilenceMuts.WithRuleUID("rule1")),
			mutators: []models.Mutator[models.Silence]{
				models.SilenceMuts.WithRuleUID("rule2"),
			},
			errContains: alertingmodels.RuleUIDLabel, // Mention matcher in error message.
		},
		{
			name:     "Updates that don't change rule_uid matcher are allowed",
			existing: models.SilenceGen(models.SilenceMuts.WithRuleUID("rule1")),
			mutators: []models.Mutator[models.Silence]{
				models.SilenceMuts.Expired(),
			},
			errContains: "", // No Error.
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			authz := fakes.FakeSilenceService{}
			authz.AuthorizeUpdateSilenceFunc = func(ctx context.Context, user identity.Requester, silence *models.Silence) error {
				return nil
			}
			silence := tc.existing()
			silenceStore := ngfakes.FakeSilenceStore{
				Silences: map[string]*models.Silence{
					*silence.ID: &silence,
				},
			}
			svc := SilenceService{
				authz: &authz,
				store: &silenceStore,
			}

			modified := models.CopySilenceWith(silence, tc.mutators...)
			_, err := svc.UpdateSilence(context.Background(), user, modified)
			if tc.errContains != "" {
				assert.Error(t, err)
				assert.ErrorContains(t, err, tc.errContains)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestSilenceService_CreateSilence_LimitsValidation(t *testing.T) {
	user := ac.BackgroundUser("test", 1, org.RoleNone, nil)

	createSilenceStore := func(existingCount int) *ngfakes.FakeSilenceStore {
		silences := make(map[string]*models.Silence, existingCount)
		for i := 0; i < existingCount; i++ {
			silence := models.SilenceGen()()
			silences[*silence.ID] = &silence
		}
		return &ngfakes.FakeSilenceStore{Silences: silences}
	}

	t.Run("CreateSilence fails when silence count limit exceeded", func(t *testing.T) {
		authz := fakes.FakeSilenceService{}
		authz.AuthorizeCreateSilenceFunc = func(ctx context.Context, user identity.Requester, silence *models.Silence) error {
			return nil
		}
		silenceStore := createSilenceStore(5)
		svc := SilenceService{
			authz: &authz,
			store: silenceStore,
			log:   log.NewNopLogger(),
			limitsProvider: &mockLimitsProvider{
				limits: &client.TenantLimits{
					Silences: &client.SilenceLimits{
						MaxSilencesCount:    5,
						MaxSilenceSizeBytes: 0, // unlimited
					},
				},
			},
		}

		newSilence := models.SilenceGen()()
		_, err := svc.CreateSilence(context.Background(), user, newSilence)

		require.ErrorIs(t, err, ErrSilenceLimitExceeded)
	})

	t.Run("CreateSilence fails when silence size limit exceeded", func(t *testing.T) {
		authz := fakes.FakeSilenceService{}
		authz.AuthorizeCreateSilenceFunc = func(ctx context.Context, user identity.Requester, silence *models.Silence) error {
			return nil
		}
		silenceStore := createSilenceStore(0)
		svc := SilenceService{
			authz: &authz,
			store: silenceStore,
			log:   log.NewNopLogger(),
			limitsProvider: &mockLimitsProvider{
				limits: &client.TenantLimits{
					Silences: &client.SilenceLimits{
						MaxSilencesCount:    0, // unlimited
						MaxSilenceSizeBytes: 10,
					},
				},
			},
		}

		// Generate a silence with many matchers to increase its size
		newSilence := models.SilenceGen(
			models.SilenceMuts.WithMatcher("label1", "very-long-value-that-exceeds-limit", labels.MatchEqual),
			models.SilenceMuts.WithMatcher("label2", "another-long-value-that-exceeds-limit", labels.MatchEqual),
		)()
		_, err := svc.CreateSilence(context.Background(), user, newSilence)

		require.ErrorIs(t, err, ErrSilenceSizeExceeded)
	})

	t.Run("CreateSilence succeeds when under limits", func(t *testing.T) {
		authz := fakes.FakeSilenceService{}
		authz.AuthorizeCreateSilenceFunc = func(ctx context.Context, user identity.Requester, silence *models.Silence) error {
			return nil
		}
		silenceStore := createSilenceStore(5)
		svc := SilenceService{
			authz: &authz,
			store: silenceStore,
			log:   log.NewNopLogger(),
			limitsProvider: &mockLimitsProvider{
				limits: &client.TenantLimits{
					Silences: &client.SilenceLimits{
						MaxSilencesCount:    10,
						MaxSilenceSizeBytes: 10000,
					},
				},
			},
		}

		newSilence := models.SilenceGen()()
		_, err := svc.CreateSilence(context.Background(), user, newSilence)

		require.NoError(t, err)
	})

	t.Run("CreateSilence succeeds when limits are nil", func(t *testing.T) {
		authz := fakes.FakeSilenceService{}
		authz.AuthorizeCreateSilenceFunc = func(ctx context.Context, user identity.Requester, silence *models.Silence) error {
			return nil
		}
		silenceStore := createSilenceStore(100)
		svc := SilenceService{
			authz: &authz,
			store: silenceStore,
			log:   log.NewNopLogger(),
			limitsProvider: &mockLimitsProvider{
				limits: nil,
			},
		}

		newSilence := models.SilenceGen()()
		_, err := svc.CreateSilence(context.Background(), user, newSilence)

		require.NoError(t, err)
	})

	t.Run("CreateSilence succeeds when limits are zero (unlimited)", func(t *testing.T) {
		authz := fakes.FakeSilenceService{}
		authz.AuthorizeCreateSilenceFunc = func(ctx context.Context, user identity.Requester, silence *models.Silence) error {
			return nil
		}
		silenceStore := createSilenceStore(100)
		svc := SilenceService{
			authz: &authz,
			store: silenceStore,
			log:   log.NewNopLogger(),
			limitsProvider: &mockLimitsProvider{
				limits: &client.TenantLimits{
					Silences: &client.SilenceLimits{
						MaxSilencesCount:    0,
						MaxSilenceSizeBytes: 0,
					},
				},
			},
		}

		newSilence := models.SilenceGen()()
		_, err := svc.CreateSilence(context.Background(), user, newSilence)

		require.NoError(t, err)
	})

	t.Run("CreateSilence succeeds when limits provider returns error (fail open)", func(t *testing.T) {
		authz := fakes.FakeSilenceService{}
		authz.AuthorizeCreateSilenceFunc = func(ctx context.Context, user identity.Requester, silence *models.Silence) error {
			return nil
		}
		silenceStore := createSilenceStore(100)
		svc := SilenceService{
			authz: &authz,
			store: silenceStore,
			log:   log.NewNopLogger(),
			limitsProvider: &mockLimitsProvider{
				err: errors.New("failed to fetch limits"),
			},
		}

		newSilence := models.SilenceGen()()
		_, err := svc.CreateSilence(context.Background(), user, newSilence)

		require.NoError(t, err)
	})

	t.Run("CreateSilence succeeds when limitsProvider is nil", func(t *testing.T) {
		authz := fakes.FakeSilenceService{}
		authz.AuthorizeCreateSilenceFunc = func(ctx context.Context, user identity.Requester, silence *models.Silence) error {
			return nil
		}
		silenceStore := createSilenceStore(100)
		svc := SilenceService{
			authz:          &authz,
			store:          silenceStore,
			log:            log.NewNopLogger(),
			limitsProvider: nil,
		}

		newSilence := models.SilenceGen()()
		_, err := svc.CreateSilence(context.Background(), user, newSilence)

		require.NoError(t, err)
	})
}

func TestSilenceService_UpdateSilence_LimitsValidation(t *testing.T) {
	user := ac.BackgroundUser("test", 1, org.RoleNone, nil)

	t.Run("UpdateSilence fails when silence size limit exceeded", func(t *testing.T) {
		authz := fakes.FakeSilenceService{}
		authz.AuthorizeUpdateSilenceFunc = func(ctx context.Context, user identity.Requester, silence *models.Silence) error {
			return nil
		}
		existingSilence := models.SilenceGen()()
		silenceStore := &ngfakes.FakeSilenceStore{
			Silences: map[string]*models.Silence{
				*existingSilence.ID: &existingSilence,
			},
		}
		svc := SilenceService{
			authz: &authz,
			store: silenceStore,
			log:   log.NewNopLogger(),
			limitsProvider: &mockLimitsProvider{
				limits: &client.TenantLimits{
					Silences: &client.SilenceLimits{
						MaxSilencesCount:    100, // Should not matter for updates
						MaxSilenceSizeBytes: 10,
					},
				},
			},
		}

		// Update with a large silence that exceeds size limit
		updatedSilence := models.CopySilenceWith(existingSilence,
			models.SilenceMuts.WithMatcher("label1", "very-long-value-that-exceeds-limit", labels.MatchEqual),
			models.SilenceMuts.WithMatcher("label2", "another-long-value-that-exceeds-limit", labels.MatchEqual),
		)
		_, err := svc.UpdateSilence(context.Background(), user, updatedSilence)

		require.ErrorIs(t, err, ErrSilenceSizeExceeded)
	})

	t.Run("UpdateSilence does not check count limit", func(t *testing.T) {
		authz := fakes.FakeSilenceService{}
		authz.AuthorizeUpdateSilenceFunc = func(ctx context.Context, user identity.Requester, silence *models.Silence) error {
			return nil
		}
		// Create a store with many silences (at or over the limit)
		silences := make(map[string]*models.Silence, 100)
		existingSilence := models.SilenceGen()()
		silences[*existingSilence.ID] = &existingSilence
		for i := 0; i < 99; i++ {
			silence := models.SilenceGen()()
			silences[*silence.ID] = &silence
		}
		silenceStore := &ngfakes.FakeSilenceStore{Silences: silences}
		svc := SilenceService{
			authz: &authz,
			store: silenceStore,
			log:   log.NewNopLogger(),
			limitsProvider: &mockLimitsProvider{
				limits: &client.TenantLimits{
					Silences: &client.SilenceLimits{
						MaxSilencesCount:    5, // Way under current count
						MaxSilenceSizeBytes: 10000,
					},
				},
			},
		}

		// Update should succeed because count limit doesn't apply to updates
		updatedSilence := models.CopySilenceWith(existingSilence, models.SilenceMuts.Expired())
		_, err := svc.UpdateSilence(context.Background(), user, updatedSilence)

		require.NoError(t, err)
	})
}

// mockLimitsProvider is a test implementation of LimitsProvider
type mockLimitsProvider struct {
	limits *client.TenantLimits
	err    error
}

func (m *mockLimitsProvider) GetLimits(_ context.Context) (*client.TenantLimits, error) {
	return m.limits, m.err
}
