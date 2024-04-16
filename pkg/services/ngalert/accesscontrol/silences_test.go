package accesscontrol

import (
	"context"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/slices"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

var orgID = rand.Int63()

func TestFilterByAccess(t *testing.T) {
	datasource1 := "datasource-1"
	datasource2 := "datasource-2"

	folder1key1 := models.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "folder-1-uid", RuleGroup: "test"}
	folder1key2 := folder1key1
	folder1key2.RuleGroup = "datasource2-group"
	folder2key1 := models.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "folder-2-uid", RuleGroup: "test"}

	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1key1.NamespaceUID)

	folder1rule1ds1 := models.AlertRuleGen(models.WithUID("folder1-rule-1-uid"), models.WithGroupKey(folder1key1), models.WithQuery(models.GenerateAlertQuery(models.WithDatasourceUID(datasource1))))()
	folder2rule1ds1 := models.AlertRuleGen(models.WithUID("folder2-rule-1-uid"), models.WithGroupKey(folder2key1), models.WithQuery(models.GenerateAlertQuery(models.WithDatasourceUID(datasource1))))()
	folder1rule2ds2 := models.AlertRuleGen(models.WithUID("folder1-rule-2-uid"), models.WithGroupKey(folder1key2), models.WithQuery(models.GenerateAlertQuery(models.WithDatasourceUID(datasource2))))()

	global := testSilence{ID: "global", RuleUID: nil}
	ruleSilence1 := testSilence{ID: "folder1-rule-1-silence", RuleUID: utils.Pointer(folder1rule1ds1.UID)}
	ruleSilence2 := testSilence{ID: "folder2-rule-1-silence", RuleUID: utils.Pointer(folder2rule1ds1.UID)}
	ruleSilence3 := testSilence{ID: "folder1-rule-2-silence", RuleUID: utils.Pointer(folder1rule2ds2.UID)}
	notFoundRule := testSilence{ID: "unknown-rule", RuleUID: utils.Pointer("unknown-rule-uid")}

	silences := []Silence{
		global,
		ruleSilence1,
		ruleSilence2,
		ruleSilence3,
		notFoundRule,
	}

	testCases := []struct {
		name             string
		user             identity.Requester
		expected         []Silence
		expectedDbAccess bool
	}{
		{
			name:             "no silence access, empty list",
			user:             newUser(),
			expected:         []Silence{},
			expectedDbAccess: false,
		},
		{
			name: "rule reader should not get anything",
			user: newUser(
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: folder1Scope},
				ac.Permission{Action: ruleRead, Scope: folder1Scope},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(datasource1)},
			),
			expected:         []Silence{},
			expectedDbAccess: false,
		},
		{
			name: "instance reader should get all",
			user: newUser(ac.Permission{Action: instancesRead}),
			expected: []Silence{
				global,
				ruleSilence1,
				ruleSilence2,
				ruleSilence3,
				notFoundRule,
			},
			expectedDbAccess: false,
		},
		{
			name: "silence reader with no rule permissions should get global only",
			user: newUser(
				ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			),
			expected: []Silence{
				global,
			},
			expectedDbAccess: true,
		},
		{
			name: "silence reader + rule reader should get global + rules in folder it has access",
			user: newUser(
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: folder1Scope},
				ac.Permission{Action: ruleRead, Scope: folder1Scope},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(datasource1)},
				ac.Permission{Action: silenceRead, Scope: folder1Scope},
			),
			expected: []Silence{
				global,
				ruleSilence1,
				// ruleSilence2 is not available due to folder and rule permissions
				// ruleSilence3 is not available due to datasource permissions
			},
			expectedDbAccess: true,
		},
		{
			name: "silence reader in all folders but + rule reader in folder1 should get global + rules in folder1 it has access",
			user: newUser(
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: ruleRead, Scope: folder1Scope},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(datasource1)},
				ac.Permission{Action: silenceRead, Scope: folder1Scope},
			),
			expected: []Silence{
				global,
				ruleSilence1,
				// ruleSilence2 is not available due to rule permissions
				// ruleSilence3 is not available due to datasource permissions
			},
			expectedDbAccess: true,
		},
		{
			name: "silence reader in folder1 and rule reader in all folder should get global + rules in folder1 it has access",
			user: newUser(
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: folder1Scope},
				ac.Permission{Action: ruleRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceAllScope()},
				ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			),
			expected: []Silence{
				global,
				ruleSilence1,
				ruleSilence3,
				// ruleSilence3 is not available due to silence permissions
			},
			expectedDbAccess: true,
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			acMock := &recordingAccessControlFake{}
			store := &fakeRuleUIDToNamespaceStore{
				Rules: map[models.AlertRuleGroupKey]models.RulesGroup{
					folder1key1: {
						folder1rule1ds1,
					},
					folder2key1: {
						folder2rule1ds1,
					},
					folder1key2: {
						folder1rule2ds2,
					},
				},
			}
			svc := NewSilenceService(acMock, store)

			actual, err := svc.FilterByAccess(context.Background(), testCase.user, silences...)

			require.NoError(t, err)
			require.ElementsMatch(t, testCase.expected, actual)

			if testCase.expectedDbAccess {
				require.Equal(t, store.Calls, 1)
			} else {
				require.Equal(t, store.Calls, 0)
			}
			require.NotEmpty(t, acMock.EvaluateRecordings)
		})
	}
}

func TestAuthorizeReadSilence(t *testing.T) {
	datasource1 := "datasource-1"

	folder1key1 := models.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "folder-1-uid", RuleGroup: "test"}
	folder2key1 := models.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "folder-2-uid", RuleGroup: "test"}

	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1key1.NamespaceUID)

	folder1rule1ds1 := models.AlertRuleGen(models.WithUID("folder1-rule-1-uid"), models.WithGroupKey(folder1key1), models.WithQuery(models.GenerateAlertQuery(models.WithDatasourceUID(datasource1))))()
	folder2rule1ds1 := models.AlertRuleGen(models.WithUID("folder2-rule-1-uid"), models.WithGroupKey(folder2key1), models.WithQuery(models.GenerateAlertQuery(models.WithDatasourceUID(datasource1))))()

	global := testSilence{ID: "global", RuleUID: nil}
	ruleSilence1 := testSilence{ID: "rule-1-silence", RuleUID: utils.Pointer(folder1rule1ds1.UID)}
	ruleSilence2 := testSilence{ID: "folder2-rule-1-silence", RuleUID: utils.Pointer(folder2rule1ds1.UID)}
	notFoundRule := testSilence{ID: "unknown-rule", RuleUID: utils.Pointer("unknown-rule-uid")}

	testCases := []struct {
		name             string
		user             identity.Requester
		silence          []testSilence
		expectedErr      error
		expectedDbAccess bool
	}{
		{
			name:             "not authorized without permissions",
			user:             newUser(),
			silence:          []testSilence{global, ruleSilence1, ruleSilence2, notFoundRule},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: false,
		},
		{
			name: "rules reader without permissions",
			user: newUser(
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: folder1Scope},
				ac.Permission{Action: ruleRead, Scope: folder1Scope},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(datasource1)},
			),
			silence:          []testSilence{global, ruleSilence1, ruleSilence2, notFoundRule},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: false,
		},
		{
			name:             "instance reader can read any silence",
			user:             newUser(ac.Permission{Action: instancesRead}),
			silence:          []testSilence{global, ruleSilence1, ruleSilence2, notFoundRule},
			expectedErr:      nil,
			expectedDbAccess: false,
		},
		{
			name:             "silence reader can read global",
			user:             newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}),
			silence:          []testSilence{global},
			expectedErr:      nil,
			expectedDbAccess: false,
		},
		{
			name:             "silence reader without rule access cannot read rule silence",
			user:             newUser(ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()}),
			silence:          []testSilence{ruleSilence1, ruleSilence2, notFoundRule},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name: "silence + rule reader can read from allowed folder",
			user: newUser(
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: folder1Scope},
				ac.Permission{Action: ruleRead, Scope: folder1Scope},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(datasource1)},
				ac.Permission{Action: silenceRead, Scope: folder1Scope},
			),
			silence:          []testSilence{ruleSilence1},
			expectedErr:      nil,
			expectedDbAccess: true,
		},
		{
			name: "silence + rule reader cannot read if no data source access",
			user: newUser(
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: folder1Scope},
				ac.Permission{Action: ruleRead, Scope: folder1Scope},
				ac.Permission{Action: silenceRead, Scope: folder1Scope},
			),
			silence:          []testSilence{ruleSilence1},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name: "silence reader cannot read unknown rule",
			user: newUser(
				ac.Permission{Action: silenceRead, Scope: folder1Scope},
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: folder1Scope},
				ac.Permission{Action: ruleRead, Scope: folder1Scope},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(datasource1)},
			),
			silence:          []testSilence{notFoundRule},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name: "silence reader cannot read from other folders",
			user: newUser(
				ac.Permission{Action: silenceRead, Scope: folder1Scope},
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: folder1Scope},
				ac.Permission{Action: ruleRead, Scope: folder1Scope},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(datasource1)},
			),
			silence:          []testSilence{ruleSilence2},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			for _, silence := range testCase.silence {
				t.Run(silence.ID, func(t *testing.T) {
					acMock := &recordingAccessControlFake{}
					store := &fakeRuleUIDToNamespaceStore{
						Rules: map[models.AlertRuleGroupKey]models.RulesGroup{
							folder1key1: {
								folder1rule1ds1,
							},
							folder2key1: {
								folder2rule1ds1,
							},
						},
					}
					svc := NewSilenceService(acMock, store)

					err := svc.AuthorizeReadSilence(context.Background(), testCase.user, silence)
					if testCase.expectedErr != nil {
						assert.ErrorIs(t, err, testCase.expectedErr)
					} else {
						assert.NoError(t, err)
					}
					if testCase.expectedDbAccess {
						require.Equal(t, store.Calls, 1)
					} else {
						require.Equal(t, store.Calls, 0)
					}
				})
			}
		})
	}
}

func TestAuthorizeCreateSilence(t *testing.T) {
	datasource1 := "datasource-1"

	folder1key1 := models.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "folder-1-uid", RuleGroup: "test"}
	folder2key1 := models.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "folder-2-uid", RuleGroup: "test"}

	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1key1.NamespaceUID)
	folder2Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2key1.NamespaceUID)

	folder1rule1ds1 := models.AlertRuleGen(models.WithUID("folder1-rule-1-uid"), models.WithGroupKey(folder1key1), models.WithQuery(models.GenerateAlertQuery(models.WithDatasourceUID(datasource1))))()
	folder2rule1ds1 := models.AlertRuleGen(models.WithUID("folder2-rule-1-uid"), models.WithGroupKey(folder2key1), models.WithQuery(models.GenerateAlertQuery(models.WithDatasourceUID(datasource1))))()

	global := testSilence{ID: "global", RuleUID: nil}
	ruleSilence1 := testSilence{ID: "rule-1-silence", RuleUID: utils.Pointer(folder1rule1ds1.UID)}
	ruleSilence2 := testSilence{ID: "folder2-rule-1-silence", RuleUID: utils.Pointer(folder2rule1ds1.UID)}
	notFoundRule := testSilence{ID: "unknown-rule", RuleUID: utils.Pointer("unknown-rule-uid")}

	silences := []testSilence{
		global,
		ruleSilence1,
		ruleSilence2,
		notFoundRule,
	}

	type expectation struct {
		expectedErr      error
		expectedDbAccess bool
	}
	noAccessNoDb := expectation{expectedDbAccess: false, expectedErr: ErrAuthorizationBase}
	dbNoAccess := expectation{expectedDbAccess: true, expectedErr: ErrAuthorizationBase}
	okNoDb := expectation{expectedErr: nil, expectedDbAccess: false}
	okDb := expectation{expectedErr: nil, expectedDbAccess: true}
	noAccessNoDbAll := map[testSilence]expectation{
		global:       noAccessNoDb,
		ruleSilence1: noAccessNoDb,
		ruleSilence2: noAccessNoDb,
		notFoundRule: noAccessNoDb,
	}
	testCases := []struct {
		name     string
		user     identity.Requester
		expected map[testSilence]expectation
	}{
		{
			name:     "not authorized without permissions",
			user:     newUser(),
			expected: noAccessNoDbAll,
		},
		{
			name:     "no create access, instance reader",
			user:     newUser(ac.Permission{Action: instancesRead}),
			expected: noAccessNoDbAll,
		},
		{
			name: "no create access, silence reader",
			user: newUser(
				ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: ruleRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceAllScope()},
			),
			expected: noAccessNoDbAll,
		},
		{
			name:     "only create access, instance create",
			user:     newUser(ac.Permission{Action: instancesCreate}),
			expected: noAccessNoDbAll,
		},
		{
			name:     "only create access, silence create",
			user:     newUser(ac.Permission{Action: silenceCreate, Scope: folder1Scope}, ac.Permission{Action: silenceCreate, Scope: folder2Scope}),
			expected: noAccessNoDbAll,
		},
		{
			name: "instance read + create can do everything",
			user: newUser(ac.Permission{Action: instancesCreate}, ac.Permission{Action: instancesRead}),
			expected: map[testSilence]expectation{
				global:       okNoDb,
				ruleSilence1: okNoDb,
				ruleSilence2: okNoDb,
				notFoundRule: okNoDb,
			},
		},
		{
			name: "instance read + silence create but no rule access",
			user: newUser(ac.Permission{Action: silenceCreate, Scope: folder1Scope}, ac.Permission{Action: instancesRead}),
			expected: map[testSilence]expectation{
				global:       noAccessNoDb,
				ruleSilence1: dbNoAccess,
				ruleSilence2: dbNoAccess,
				notFoundRule: dbNoAccess,
			},
		},
		{
			name: "rule read, silence read + instance create",
			user: newUser(
				ac.Permission{Action: silenceRead, Scope: folder1Scope},
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: folder1Scope},
				ac.Permission{Action: ruleRead, Scope: folder1Scope},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(datasource1)},
				ac.Permission{Action: instancesCreate}),
			expected: map[testSilence]expectation{
				global:       okNoDb,
				ruleSilence1: okDb,
				ruleSilence2: dbNoAccess,
				notFoundRule: dbNoAccess,
			},
		},
		{
			name: "rule read, silence read + create",
			user: newUser(
				ac.Permission{Action: silenceRead, Scope: folder1Scope},
				ac.Permission{Action: silenceCreate, Scope: folder1Scope},
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: ruleRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceAllScope()},
			),
			expected: map[testSilence]expectation{
				global:       noAccessNoDb,
				ruleSilence1: okDb,
				ruleSilence2: dbNoAccess,
				notFoundRule: dbNoAccess,
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			for _, silence := range silences {
				var expected expectation
				if s, ok := testCase.expected[silence]; ok {
					expected = s
				}
				t.Run(silence.ID, func(t *testing.T) {
					ac := &recordingAccessControlFake{}
					store := &fakeRuleUIDToNamespaceStore{
						Rules: map[models.AlertRuleGroupKey]models.RulesGroup{
							folder1key1: {
								folder1rule1ds1,
							},
							folder2key1: {
								folder2rule1ds1,
							},
						},
					}
					svc := NewSilenceService(ac, store)

					err := svc.AuthorizeCreateSilence(context.Background(), testCase.user, silence)
					if expected.expectedErr != nil {
						assert.Error(t, err)
						assert.ErrorIs(t, err, expected.expectedErr)
					} else {
						assert.NoError(t, err)
					}
					if expected.expectedDbAccess {
						require.Equal(t, 1, store.Calls)
					} else {
						require.Equal(t, 0, store.Calls)
					}
				})
			}
		})
	}
}

func TestAuthorizeUpdateSilence(t *testing.T) {
	datasource1 := "datasource-1"

	folder1key1 := models.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "folder-1-uid", RuleGroup: "test"}
	folder2key1 := models.AlertRuleGroupKey{OrgID: orgID, NamespaceUID: "folder-2-uid", RuleGroup: "test"}

	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1key1.NamespaceUID)
	folder2Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2key1.NamespaceUID)

	folder1rule1ds1 := models.AlertRuleGen(models.WithUID("folder1-rule-1-uid"), models.WithGroupKey(folder1key1), models.WithQuery(models.GenerateAlertQuery(models.WithDatasourceUID(datasource1))))()
	folder2rule1ds1 := models.AlertRuleGen(models.WithUID("folder2-rule-1-uid"), models.WithGroupKey(folder2key1), models.WithQuery(models.GenerateAlertQuery(models.WithDatasourceUID(datasource1))))()

	global := testSilence{ID: "global", RuleUID: nil}
	ruleSilence1 := testSilence{ID: "rule-1-silence", RuleUID: utils.Pointer(folder1rule1ds1.UID)}
	ruleSilence2 := testSilence{ID: "folder2-rule-1-silence", RuleUID: utils.Pointer(folder2rule1ds1.UID)}
	notFoundRule := testSilence{ID: "unknown-rule", RuleUID: utils.Pointer("unknown-rule-uid")}

	silences := []testSilence{
		global,
		ruleSilence1,
		ruleSilence2,
		notFoundRule,
	}

	type expectation struct {
		expectedErr      error
		expectedDbAccess bool
	}
	noAccessNoDb := expectation{expectedDbAccess: false, expectedErr: ErrAuthorizationBase}
	dbNoAccess := expectation{expectedDbAccess: true, expectedErr: ErrAuthorizationBase}
	okNoDb := expectation{expectedErr: nil, expectedDbAccess: false}
	okDb := expectation{expectedErr: nil, expectedDbAccess: true}
	noAccessNoDbAll := map[testSilence]expectation{
		global:       noAccessNoDb,
		ruleSilence1: noAccessNoDb,
		ruleSilence2: noAccessNoDb,
		notFoundRule: noAccessNoDb,
	}
	testCases := []struct {
		name     string
		user     identity.Requester
		expected map[testSilence]expectation
	}{
		{
			name:     "not authorized without permissions",
			user:     newUser(),
			expected: noAccessNoDbAll,
		},
		{
			name:     "no write access, instance reader",
			user:     newUser(ac.Permission{Action: instancesRead}),
			expected: noAccessNoDbAll,
		},
		{
			name: "no write access, silence reader",
			user: newUser(
				ac.Permission{Action: silenceRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: ruleRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceAllScope()},
			),
			expected: noAccessNoDbAll,
		},
		{
			name:     "only write access, instance write",
			user:     newUser(ac.Permission{Action: instancesWrite}),
			expected: noAccessNoDbAll,
		},
		{
			name:     "only write access, silence write",
			user:     newUser(ac.Permission{Action: silenceWrite, Scope: folder1Scope}, ac.Permission{Action: silenceWrite, Scope: folder2Scope}),
			expected: noAccessNoDbAll,
		},
		{
			name: "instance read + write can do everything",
			user: newUser(ac.Permission{Action: instancesWrite}, ac.Permission{Action: instancesRead}),
			expected: map[testSilence]expectation{
				global:       okNoDb,
				ruleSilence1: okNoDb,
				ruleSilence2: okNoDb,
				notFoundRule: okNoDb,
			},
		},
		{
			name: "instance read + silence write but no rule access",
			user: newUser(ac.Permission{Action: silenceWrite, Scope: folder1Scope}, ac.Permission{Action: instancesRead}),
			expected: map[testSilence]expectation{
				global:       noAccessNoDb,
				ruleSilence1: dbNoAccess,
				ruleSilence2: dbNoAccess,
				notFoundRule: dbNoAccess,
			},
		},
		{
			name: "rule read, silence read + instance write",
			user: newUser(
				ac.Permission{Action: silenceRead, Scope: folder1Scope},
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: folder1Scope},
				ac.Permission{Action: ruleRead, Scope: folder1Scope},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(datasource1)},
				ac.Permission{Action: instancesWrite}),
			expected: map[testSilence]expectation{
				global:       okNoDb,
				ruleSilence1: okDb,
				ruleSilence2: dbNoAccess,
				notFoundRule: dbNoAccess,
			},
		},
		{
			name: "rule read, silence read + write",
			user: newUser(
				ac.Permission{Action: silenceRead, Scope: folder1Scope},
				ac.Permission{Action: silenceWrite, Scope: folder1Scope},
				ac.Permission{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: ruleRead, Scope: dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				ac.Permission{Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceAllScope()},
			),
			expected: map[testSilence]expectation{
				global:       noAccessNoDb,
				ruleSilence1: okDb,
				ruleSilence2: dbNoAccess,
				notFoundRule: dbNoAccess,
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			for _, silence := range silences {
				var expected expectation
				if s, ok := testCase.expected[silence]; ok {
					expected = s
				}
				t.Run(silence.ID, func(t *testing.T) {
					acMock := &recordingAccessControlFake{}
					store := &fakeRuleUIDToNamespaceStore{
						Rules: map[models.AlertRuleGroupKey]models.RulesGroup{
							folder1key1: {
								folder1rule1ds1,
							},
							folder2key1: {
								folder2rule1ds1,
							},
						},
					}
					svc := NewSilenceService(acMock, store)

					err := svc.AuthorizeUpdateSilence(context.Background(), testCase.user, silence)
					if expected.expectedErr != nil {
						assert.Error(t, err)
						assert.ErrorIs(t, err, expected.expectedErr)
					} else {
						assert.NoError(t, err)
					}
					if expected.expectedDbAccess {
						require.Equal(t, 1, store.Calls)
					} else {
						require.Equal(t, 0, store.Calls)
					}
				})
			}
		})
	}
}

type testSilence struct {
	ID      string
	RuleUID *string
}

func (t testSilence) GetRuleUID() *string {
	return t.RuleUID
}

type fakeRuleUIDToNamespaceStore struct {
	Rules map[models.AlertRuleGroupKey]models.RulesGroup
	Calls int
}

func (f *fakeRuleUIDToNamespaceStore) GetRuleGroupsByRuleUIDs(ctx context.Context, orgID int64, uids ...string) (map[models.AlertRuleGroupKey]models.RulesGroup, error) {
	response := map[models.AlertRuleGroupKey]models.RulesGroup{}
	for key, group := range f.Rules {
		for _, uid := range uids {
			if slices.ContainsFunc(group, func(rule *models.AlertRule) bool {
				return rule.UID == uid
			}) {
				response[key] = group
				break
			}
		}
	}
	f.Calls++
	return response, nil
}

func newUser(permissions ...ac.Permission) identity.Requester {
	return ac.BackgroundUser("test", orgID, org.RoleNone, permissions)
}
