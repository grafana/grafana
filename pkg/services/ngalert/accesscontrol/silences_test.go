package accesscontrol

import (
	"context"
	"math/rand"
	"testing"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingModels "github.com/grafana/alerting/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/grafana/grafana/pkg/util"
)

var orgID = rand.Int63()

func TestFilterByAccess(t *testing.T) {
	global := testSilence("global", nil)
	ruleSilence1 := testSilence("rule-1", utils.Pointer("rule-1-uid"))
	folder1 := "rule-1-folder-uid"
	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1)
	ruleSilence2 := testSilence("rule-2", utils.Pointer("rule-2-uid"))
	folder2 := "rule-2-folder-uid"
	notFoundRule := testSilence("unknown-rule", utils.Pointer("unknown-rule-uid"))

	silences := []*models.Silence{
		global,
		ruleSilence1,
		ruleSilence2,
		notFoundRule,
	}

	testCases := []struct {
		name             string
		user             identity.Requester
		expected         []*models.Silence
		expectedErr      error
		expectedDbAccess bool
	}{
		{
			name:             "no silence access, cannot read",
			user:             newUser(),
			expected:         []*models.Silence{},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: false,
		},
		{
			name: "instance reader should get all",
			user: newUser(ac.Permission{Action: instancesRead}),
			expected: []*models.Silence{
				global,
				ruleSilence1,
				ruleSilence2,
				notFoundRule,
			},
			expectedDbAccess: false,
		},
		{
			name: "silence wildcard should get all",
			user: newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			expected: []*models.Silence{
				global,
				ruleSilence1,
				ruleSilence2,
				notFoundRule,
			},
			expectedDbAccess: false,
		},
		{
			name: "silence reader should get global + folder",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}),
			expected: []*models.Silence{
				global,
				ruleSilence1,
			},
			expectedDbAccess: true,
		},
		{
			name: "silence reader with no accessible rule silences, global only",
			user: newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("unknown-folder")}),
			expected: []*models.Silence{
				global,
			},
			expectedDbAccess: true,
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			ac := &recordingAccessControlFake{}
			store := &fakeRuleUIDToNamespaceStore{
				Response: map[string]string{
					*ruleSilence1.GetRuleUID(): folder1,
					*ruleSilence2.GetRuleUID(): folder2,
				},
			}
			svc := NewSilenceService(ac, store)

			actual, err := svc.FilterByAccess(context.Background(), testCase.user, silences...)

			if testCase.expectedErr != nil {
				assert.ErrorIs(t, err, testCase.expectedErr)
			} else {
				assert.NoError(t, err)
				require.ElementsMatch(t, testCase.expected, actual)
			}

			if testCase.expectedDbAccess {
				require.Equal(t, store.Calls, 1)
			} else {
				require.Equal(t, store.Calls, 0)
			}
			require.NotEmpty(t, ac.EvaluateRecordings)
		})
	}
}

func TestAuthorizeReadSilence(t *testing.T) {
	global := testSilence("global", nil)
	ruleSilence1 := testSilence("rule-1", utils.Pointer("rule-1-uid"))
	folder1 := "rule-1-folder-uid"
	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1)
	ruleSilence2 := testSilence("rule-2", utils.Pointer("rule-2-uid"))
	folder2 := "rule-2-folder-uid"
	notFoundRule := testSilence("unknown-rule", utils.Pointer("unknown-rule-uid"))

	testCases := []struct {
		name             string
		user             identity.Requester
		silence          []*models.Silence
		expectedErr      error
		expectedDbAccess bool
	}{
		{
			name:             "not authorized without permissions",
			user:             newUser(),
			silence:          []*models.Silence{global, ruleSilence1, notFoundRule},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: false,
		},
		{
			name:             "instance reader can read any silence",
			user:             newUser(ac.Permission{Action: instancesRead}),
			silence:          []*models.Silence{global, ruleSilence1, notFoundRule},
			expectedErr:      nil,
			expectedDbAccess: false,
		},
		{
			name:             "silence wildcard reader can read any silence",
			user:             newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			silence:          []*models.Silence{global, ruleSilence1, notFoundRule},
			expectedErr:      nil,
			expectedDbAccess: false,
		},
		{
			name:             "silence reader can read global",
			user:             newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}),
			silence:          []*models.Silence{global},
			expectedErr:      nil,
			expectedDbAccess: false,
		},
		{
			name:             "silence reader can read from allowed folder",
			user:             newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}),
			silence:          []*models.Silence{ruleSilence1},
			expectedErr:      nil,
			expectedDbAccess: true,
		},
		{
			name:             "silence reader cannot read from other folders",
			user:             newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}),
			silence:          []*models.Silence{ruleSilence2},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name:             "silence reader cannot read unknown rule",
			user:             newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}),
			silence:          []*models.Silence{notFoundRule},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			for _, silence := range testCase.silence {
				t.Run(*silence.ID, func(t *testing.T) {
					ac := &recordingAccessControlFake{}
					store := &fakeRuleUIDToNamespaceStore{
						Response: map[string]string{
							*ruleSilence1.GetRuleUID(): folder1,
							*ruleSilence2.GetRuleUID(): folder2,
						},
					}
					svc := NewSilenceService(ac, store)

					err := svc.AuthorizeReadSilence(context.Background(), testCase.user, silence)
					if testCase.expectedErr != nil {
						assert.ErrorIs(t, err, testCase.expectedErr)
					} else {
						assert.NoError(t, err)
					}
					if testCase.expectedDbAccess {
						require.Equal(t, 1, store.Calls)
					} else {
						require.Equal(t, 0, store.Calls)
					}

					// Verify SilenceAccess.
					permSets, err := svc.SilenceAccess(context.Background(), testCase.user, []*models.Silence{silence})
					assert.NoError(t, err)
					assert.Len(t, permSets, 1)
					assert.Equal(t, testCase.expectedErr == nil, permSets[silence].Has(models.SilencePermissionRead))
				})
			}
		})
	}
}

func TestAuthorizeCreateSilence(t *testing.T) {
	global := testSilence("global", nil)
	ruleSilence1 := testSilence("rule-1", utils.Pointer("rule-1-uid"))
	folder1 := "rule-1-folder-uid"
	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1)
	ruleSilence2 := testSilence("rule-2", utils.Pointer("rule-2-uid"))
	folder2 := "rule-2-folder-uid"
	folder2Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2)
	notFoundRule := testSilence("unknown-rule", utils.Pointer("unknown-rule-uid"))

	silences := []*models.Silence{
		global,
		ruleSilence1,
		ruleSilence2,
		notFoundRule,
	}

	type override struct {
		expectedErr      error
		expectedDbAccess bool
	}
	testCases := []struct {
		name             string
		user             identity.Requester
		expectedErr      error
		expectedDbAccess bool
		overrides        map[*models.Silence]override
	}{
		{
			name:        "not authorized without permissions",
			user:        newUser(),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "no create access, instance reader",
			user:        newUser(ac.Permission{Action: instancesRead}),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "no create access, silence wildcard reader",
			user:        newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "no create access, silence reader",
			user:        newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceRead, Scope: folder2Scope}),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "only create access, instance create",
			user:        newUser(ac.Permission{Action: instancesCreate}),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "only create access, silence create",
			user:        newUser(ac.Permission{Action: silenceCreate, Scope: folder1Scope}, ac.Permission{Action: silenceCreate, Scope: folder2Scope}),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "instance read + create can do everything",
			user:        newUser(ac.Permission{Action: instancesCreate}, ac.Permission{Action: instancesRead}),
			expectedErr: nil,
		},
		{
			name:        "silence wildcard read + instance create can do everything",
			user:        newUser(ac.Permission{Action: instancesCreate}, ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			expectedErr: nil,
		},
		{
			name: "instance read + silence create",
			user: newUser(ac.Permission{Action: silenceCreate, Scope: folder1Scope}, ac.Permission{Action: instancesRead}),
			overrides: map[*models.Silence]override{
				global: {
					expectedErr:      ErrAuthorizationBase,
					expectedDbAccess: false,
				},
				ruleSilence1: {
					expectedErr:      nil,
					expectedDbAccess: true,
				},
			},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name: "silence read + instance create",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: instancesCreate}),
			overrides: map[*models.Silence]override{
				global: {
					expectedErr:      nil,
					expectedDbAccess: false,
				},
				ruleSilence1: {
					expectedErr:      nil,
					expectedDbAccess: true,
				},
			},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name: "silence read + silence wildcard create",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceCreate, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			overrides: map[*models.Silence]override{
				global: {
					expectedErr:      ErrAuthorizationBase,
					expectedDbAccess: false,
				},
				ruleSilence1: {
					expectedErr:      nil,
					expectedDbAccess: true,
				},
			},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name: "silence read + create",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceCreate, Scope: folder1Scope}),
			overrides: map[*models.Silence]override{
				global: {
					expectedErr:      ErrAuthorizationBase,
					expectedDbAccess: false,
				},
				ruleSilence1: {
					expectedErr:      nil,
					expectedDbAccess: true,
				},
			},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			for _, silence := range silences {
				expectedErr := testCase.expectedErr
				expectedDbAccess := testCase.expectedDbAccess
				if s, ok := testCase.overrides[silence]; ok {
					expectedErr = s.expectedErr
					expectedDbAccess = s.expectedDbAccess
				}
				t.Run(*silence.ID, func(t *testing.T) {
					ac := &recordingAccessControlFake{}
					store := &fakeRuleUIDToNamespaceStore{
						Response: map[string]string{
							*ruleSilence1.GetRuleUID(): folder1,
							*ruleSilence2.GetRuleUID(): folder2,
						},
					}
					svc := NewSilenceService(ac, store)

					err := svc.AuthorizeCreateSilence(context.Background(), testCase.user, silence)
					if expectedErr != nil {
						assert.Error(t, err)
						assert.ErrorIs(t, err, expectedErr)
					} else {
						assert.NoError(t, err)
					}
					if expectedDbAccess {
						require.Equal(t, 1, store.Calls)
					} else {
						require.Equal(t, 0, store.Calls)
					}

					// Verify SilenceAccess.
					permSets, err := svc.SilenceAccess(context.Background(), testCase.user, []*models.Silence{silence})
					assert.NoError(t, err)
					assert.Len(t, permSets, 1)
					assert.Equal(t, expectedErr == nil, permSets[silence].Has(models.SilencePermissionCreate))
				})
			}
		})
	}
}

func TestAuthorizeUpdateSilence(t *testing.T) {
	global := testSilence("global", nil)
	ruleSilence1 := testSilence("rule-1", utils.Pointer("rule-1-uid"))
	folder1 := "rule-1-folder-uid"
	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1)
	ruleSilence2 := testSilence("rule-2", utils.Pointer("rule-2-uid"))
	folder2 := "rule-2-folder-uid"
	folder2Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2)
	notFoundRule := testSilence("unknown-rule", utils.Pointer("unknown-rule-uid"))

	silences := []*models.Silence{
		global,
		ruleSilence1,
		ruleSilence2,
		notFoundRule,
	}

	type override struct {
		expectedErr      error
		expectedDbAccess bool
	}
	testCases := []struct {
		name             string
		user             identity.Requester
		expectedErr      error
		expectedDbAccess bool
		overrides        map[*models.Silence]override
	}{
		{
			name:        "not authorized without permissions",
			user:        newUser(),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "no write access, instance reader",
			user:        newUser(ac.Permission{Action: instancesRead}),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "no write access, silence wildcard reader",
			user:        newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "no write access, silence reader",
			user:        newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceRead, Scope: folder2Scope}),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "only write access, instance write",
			user:        newUser(ac.Permission{Action: instancesWrite}),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "only write access, silence write",
			user:        newUser(ac.Permission{Action: silenceWrite, Scope: folder1Scope}, ac.Permission{Action: silenceWrite, Scope: folder2Scope}),
			expectedErr: ErrAuthorizationBase,
		},
		{
			name:        "instance read + write can do everything",
			user:        newUser(ac.Permission{Action: instancesWrite}, ac.Permission{Action: instancesRead}),
			expectedErr: nil,
		},
		{
			name:        "silence wildcard read + instance write can do everything",
			user:        newUser(ac.Permission{Action: instancesWrite}, ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			expectedErr: nil,
		},
		{
			name: "instance read + silence write",
			user: newUser(ac.Permission{Action: silenceWrite, Scope: folder1Scope}, ac.Permission{Action: instancesRead}),
			overrides: map[*models.Silence]override{
				global: {
					expectedErr:      ErrAuthorizationBase,
					expectedDbAccess: false,
				},
				ruleSilence1: {
					expectedErr:      nil,
					expectedDbAccess: true,
				},
			},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name: "silence read + instance write",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: instancesWrite}),
			overrides: map[*models.Silence]override{
				global: {
					expectedErr:      nil,
					expectedDbAccess: false,
				},
				ruleSilence1: {
					expectedErr:      nil,
					expectedDbAccess: true,
				},
			},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name: "silence read + silence wildcard write",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			overrides: map[*models.Silence]override{
				global: {
					expectedErr:      ErrAuthorizationBase,
					expectedDbAccess: false,
				},
				ruleSilence1: {
					expectedErr:      nil,
					expectedDbAccess: true,
				},
			},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name: "silence read + write",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceWrite, Scope: folder1Scope}),
			overrides: map[*models.Silence]override{
				global: {
					expectedErr:      ErrAuthorizationBase,
					expectedDbAccess: false,
				},
				ruleSilence1: {
					expectedErr:      nil,
					expectedDbAccess: true,
				},
			},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			for _, silence := range silences {
				expectedErr := testCase.expectedErr
				expectedDbAccess := testCase.expectedDbAccess
				if s, ok := testCase.overrides[silence]; ok {
					expectedErr = s.expectedErr
					expectedDbAccess = s.expectedDbAccess
				}
				t.Run(*silence.ID, func(t *testing.T) {
					ac := &recordingAccessControlFake{}
					store := &fakeRuleUIDToNamespaceStore{
						Response: map[string]string{
							*ruleSilence1.GetRuleUID(): folder1,
							*ruleSilence2.GetRuleUID(): folder2,
						},
					}
					svc := NewSilenceService(ac, store)

					err := svc.AuthorizeUpdateSilence(context.Background(), testCase.user, silence)
					if expectedErr != nil {
						assert.Error(t, err)
						assert.ErrorIs(t, err, expectedErr)
					} else {
						assert.NoError(t, err)
					}
					if expectedDbAccess {
						require.Equal(t, 1, store.Calls)
					} else {
						require.Equal(t, 0, store.Calls)
					}

					// Verify SilenceAccess.
					permSets, err := svc.SilenceAccess(context.Background(), testCase.user, []*models.Silence{silence})
					assert.NoError(t, err)
					assert.Len(t, permSets, 1)
					assert.Equal(t, expectedErr == nil, permSets[silence].Has(models.SilencePermissionWrite))
				})
			}
		})
	}
}

func TestSilenceAccess(t *testing.T) {
	global := testSilence("global", nil)
	ruleSilence1 := testSilence("rule-1", utils.Pointer("rule-1-uid"))
	folder1 := "rule-1-folder-uid"
	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1)
	ruleSilence2 := testSilence("rule-2", utils.Pointer("rule-2-uid"))
	folder2 := "rule-2-folder-uid"
	folder2Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2)
	notFoundRule := testSilence("unknown-rule", utils.Pointer("unknown-rule-uid"))

	silences := []*models.Silence{
		global,
		ruleSilence1,
		ruleSilence2,
		notFoundRule,
	}

	type override struct {
		expectedPermissions models.SilencePermissionSet
	}

	permit := func(permission ...models.SilencePermission) override {
		o := override{expectedPermissions: models.SilencePermissionSet{}}
		for _, p := range permission {
			o.expectedPermissions[p] = true
		}
		return o
	}

	deny := func(permission ...models.SilencePermission) override {
		o := override{expectedPermissions: models.SilencePermissionSet{}}
		for _, p := range permission {
			o.expectedPermissions[p] = false
		}
		return o
	}

	testCases := []struct {
		name                string
		user                identity.Requester
		expectedPermissions models.SilencePermissionSet
		expectedDbAccess    bool
		overrides           map[*models.Silence]override
	}{
		{
			name: "not authorized without permissions",
			user: newUser(),
		},
		{
			name: "instance read gives read access to everything",
			user: newUser(ac.Permission{Action: instancesRead}),
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead: true,
			},
		},
		{
			name: "silence wildcard read gives read access to everything",
			user: newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead: true,
			},
		},
		{
			name: "silence read in folders gives read access to global and folders",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceRead, Scope: folder2Scope}),
			overrides: map[*models.Silence]override{
				global:       permit(models.SilencePermissionRead),
				ruleSilence1: permit(models.SilencePermissionRead),
				ruleSilence2: permit(models.SilencePermissionRead),
			},
			expectedPermissions: models.SilencePermissionSet{},
			expectedDbAccess:    true,
		},
		{
			name: "instance reade+write+create can do everything",
			user: newUser(ac.Permission{Action: instancesRead}, ac.Permission{Action: instancesWrite}, ac.Permission{Action: instancesCreate}),
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead:   true,
				models.SilencePermissionCreate: true,
				models.SilencePermissionWrite:  true,
			},
		},
		{
			name: "silence wildcard read + instance write+create can do everything",
			user: newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}, ac.Permission{Action: instancesWrite}, ac.Permission{Action: instancesCreate}),
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead:   true,
				models.SilencePermissionCreate: true,
				models.SilencePermissionWrite:  true,
			},
		},
		{
			name: "instance readr+write can read and write",
			user: newUser(ac.Permission{Action: instancesRead}, ac.Permission{Action: instancesWrite}),
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead:  true,
				models.SilencePermissionWrite: true,
			},
		},
		{
			name: "silence wildcard read + instance write can read and write",
			user: newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}, ac.Permission{Action: instancesWrite}),
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead:  true,
				models.SilencePermissionWrite: true,
			},
		},
		{
			name: "instance reader+create can read and create",
			user: newUser(ac.Permission{Action: instancesRead}, ac.Permission{Action: instancesCreate}),
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead:   true,
				models.SilencePermissionCreate: true,
			},
		},
		{
			name: "silence wildcard read + instance create can read and create",
			user: newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}, ac.Permission{Action: instancesCreate}),
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead:   true,
				models.SilencePermissionCreate: true,
			},
		},
		{
			name:                "cannot write/create without read - instance permissions",
			user:                newUser(ac.Permission{Action: instancesWrite}, ac.Permission{Action: instancesCreate}),
			expectedPermissions: models.SilencePermissionSet{},
		},
		{
			name:                "cannot write/create without read - silence permissions",
			user:                newUser(ac.Permission{Action: silenceWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}, ac.Permission{Action: silenceCreate, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			expectedPermissions: models.SilencePermissionSet{},
		},
		{
			name: "instance read + silence write in folder",
			user: newUser(ac.Permission{Action: silenceWrite, Scope: folder1Scope}, ac.Permission{Action: instancesRead}),
			overrides: map[*models.Silence]override{
				ruleSilence1: permit(models.SilencePermissionWrite),
			},
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead: true,
			},
			expectedDbAccess: true,
		},
		{
			name: "instance read + silence create in folder",
			user: newUser(ac.Permission{Action: silenceCreate, Scope: folder1Scope}, ac.Permission{Action: instancesRead}),
			overrides: map[*models.Silence]override{
				ruleSilence1: permit(models.SilencePermissionCreate),
			},
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead: true,
			},
			expectedDbAccess: true,
		},
		{
			name: "silence read in folder + instance write also provides global write",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: instancesWrite}),
			overrides: map[*models.Silence]override{
				global:       permit(models.SilencePermissionRead, models.SilencePermissionWrite),
				ruleSilence1: permit(models.SilencePermissionRead, models.SilencePermissionWrite),
			},
			expectedPermissions: models.SilencePermissionSet{},
			expectedDbAccess:    true,
		},
		{
			name: "silence read in folder + instance create also provides global create",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: instancesCreate}),
			overrides: map[*models.Silence]override{
				global:       permit(models.SilencePermissionRead, models.SilencePermissionCreate),
				ruleSilence1: permit(models.SilencePermissionRead, models.SilencePermissionCreate),
			},
			expectedPermissions: models.SilencePermissionSet{},
			expectedDbAccess:    true,
		},
		{
			name: "silence wildcard write doesn't provide global write but does provide unknown rule write",
			user: newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}, ac.Permission{Action: silenceWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			overrides: map[*models.Silence]override{
				global:       deny(models.SilencePermissionWrite),
				notFoundRule: deny(models.SilencePermissionWrite), // This is arguable, can consider changing this in the future.
			},
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead:  true,
				models.SilencePermissionWrite: true,
			},
			expectedDbAccess: true,
		},
		{
			name: "silence wildcard create doesn't provide global create but does provide unknown rule create",
			user: newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}, ac.Permission{Action: silenceCreate, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			overrides: map[*models.Silence]override{
				global:       deny(models.SilencePermissionCreate),
				notFoundRule: deny(models.SilencePermissionCreate), // This is arguable, can consider changing this in the future.
			},
			expectedPermissions: models.SilencePermissionSet{
				models.SilencePermissionRead:   true,
				models.SilencePermissionCreate: true,
			},
			expectedDbAccess: true,
		},
		{
			name: "silence read + write in single folder",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceWrite, Scope: folder1Scope}),
			overrides: map[*models.Silence]override{
				global:       permit(models.SilencePermissionRead),
				ruleSilence1: permit(models.SilencePermissionRead, models.SilencePermissionWrite),
			},
			expectedPermissions: models.SilencePermissionSet{},
			expectedDbAccess:    true,
		},
		{
			name: "silence read + create in single folder",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceCreate, Scope: folder1Scope}),
			overrides: map[*models.Silence]override{
				global:       permit(models.SilencePermissionRead),
				ruleSilence1: permit(models.SilencePermissionRead, models.SilencePermissionCreate),
			},
			expectedPermissions: models.SilencePermissionSet{},
			expectedDbAccess:    true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ac := &recordingAccessControlFake{}
			store := &fakeRuleUIDToNamespaceStore{
				Response: map[string]string{
					*ruleSilence1.GetRuleUID(): folder1,
					*ruleSilence2.GetRuleUID(): folder2,
				},
			}
			svc := NewSilenceService(ac, store)

			perms, err := svc.SilenceAccess(context.Background(), tc.user, silences)
			assert.NoError(t, err)
			if tc.expectedDbAccess {
				assert.Equalf(t, 1, store.Calls, "expected 1 db access, but got %d store calls", store.Calls)
			} else {
				assert.Equalf(t, 0, store.Calls, "expected no db access, but got %d store calls", store.Calls)
			}

			for _, silence := range silences {
				expectedPermissions := tc.expectedPermissions.Clone()
				if s, ok := tc.overrides[silence]; ok {
					for k, v := range s.expectedPermissions {
						expectedPermissions[k] = v
					}
				}
				for _, permission := range models.SilencePermissions() {
					assert.Equalf(t, expectedPermissions.Has(permission), perms[silence].Has(permission), "expected %s=%t permission for silence %s but got %t", permission, expectedPermissions.Has(permission), *silence.ID, perms[silence].Has(permission))
				}
			}
		})
	}
}

func testSilence(id string, ruleUID *string) *models.Silence {
	s := &models.Silence{ID: &id}
	if ruleUID != nil {
		s.Matchers = amv2.Matchers{{
			IsEqual: util.Pointer(true),
			IsRegex: util.Pointer(false),
			Name:    util.Pointer(alertingModels.RuleUIDLabel),
			Value:   ruleUID,
		}}
	}
	return s
}

type fakeRuleUIDToNamespaceStore struct {
	Response map[string]string
	Calls    int
}

func (f *fakeRuleUIDToNamespaceStore) GetNamespacesByRuleUID(ctx context.Context, orgID int64, uids ...string) (map[string]string, error) {
	f.Calls++
	return f.Response, nil
}

func newUser(permissions ...ac.Permission) identity.Requester {
	return ac.BackgroundUser("test", orgID, org.RoleNone, permissions)
}
