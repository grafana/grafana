package accesscontrol

import (
	"context"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

var orgID = rand.Int63()

func TestFilterByAccess(t *testing.T) {
	global := testSilence{ID: "global", RuleUID: nil}
	ruleSilence1 := testSilence{ID: "rule-1", RuleUID: utils.Pointer("rule-1-uid")}
	folder1 := "rule-1-folder-uid"
	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1)
	ruleSilence2 := testSilence{ID: "rule-2", RuleUID: utils.Pointer("rule-2-uid")}
	folder2 := "rule-2-folder-uid"
	notFoundRule := testSilence{ID: "unknown-rule", RuleUID: utils.Pointer("unknown-rule-uid")}

	silences := []Silence{
		global,
		ruleSilence1,
		ruleSilence2,
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
			name: "instance reader should get all",
			user: newUser(ac.Permission{Action: instancesRead}),
			expected: []Silence{
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
			expected: []Silence{
				global,
				ruleSilence1,
			},
			expectedDbAccess: true,
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			ac := &recordingAccessControlFake{}
			store := &fakeRuleUIDToNamespaceStore{
				Response: map[string]string{
					*ruleSilence1.RuleUID: folder1,
					*ruleSilence2.RuleUID: folder2,
				},
			}
			svc := NewSilenceService(ac, store)

			actual, err := svc.FilterByAccess(context.Background(), testCase.user, silences...)

			require.NoError(t, err)
			require.ElementsMatch(t, testCase.expected, actual)

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
	global := testSilence{ID: "global", RuleUID: nil}
	ruleSilence1 := testSilence{ID: "rule-1", RuleUID: utils.Pointer("rule-1-uid")}
	folder1 := "rule-1-folder-uid"
	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1)
	ruleSilence2 := testSilence{ID: "rule-2", RuleUID: utils.Pointer("rule-2-uid")}
	folder2 := "rule-2-folder-uid"
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
			silence:          []testSilence{global, ruleSilence1, notFoundRule},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: false,
		},
		{
			name:             "instance reader can read any silence",
			user:             newUser(ac.Permission{Action: instancesRead}),
			silence:          []testSilence{global, ruleSilence1, notFoundRule},
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
			name:             "silence reader can read from allowed folder",
			user:             newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}),
			silence:          []testSilence{ruleSilence1},
			expectedErr:      nil,
			expectedDbAccess: true,
		},
		{
			name:             "silence reader cannot read from other folders",
			user:             newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}),
			silence:          []testSilence{ruleSilence2},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
		{
			name:             "silence reader cannot read unknown rule",
			user:             newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}),
			silence:          []testSilence{notFoundRule},
			expectedErr:      ErrAuthorizationBase,
			expectedDbAccess: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			for _, silence := range testCase.silence {
				t.Run(silence.ID, func(t *testing.T) {
					ac := &recordingAccessControlFake{}
					store := &fakeRuleUIDToNamespaceStore{
						Response: map[string]string{
							*ruleSilence1.RuleUID: folder1,
							*ruleSilence2.RuleUID: folder2,
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
	global := testSilence{ID: "global", RuleUID: nil}
	ruleSilence1 := testSilence{ID: "rule-1", RuleUID: utils.Pointer("rule-1-uid")}
	folder1 := "rule-1-folder-uid"
	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1)
	ruleSilence2 := testSilence{ID: "rule-2", RuleUID: utils.Pointer("rule-2-uid")}
	folder2 := "rule-2-folder-uid"
	folder2Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2)
	notFoundRule := testSilence{ID: "unknown-rule", RuleUID: utils.Pointer("unknown-rule-uid")}

	silences := []testSilence{
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
		overrides        map[testSilence]override
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
			name: "instance read + silence create",
			user: newUser(ac.Permission{Action: silenceCreate, Scope: folder1Scope}, ac.Permission{Action: instancesRead}),
			overrides: map[testSilence]override{
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
			overrides: map[testSilence]override{
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
			name: "silence read + create",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceCreate, Scope: folder1Scope}),
			overrides: map[testSilence]override{
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
				t.Run(silence.ID, func(t *testing.T) {
					ac := &recordingAccessControlFake{}
					store := &fakeRuleUIDToNamespaceStore{
						Response: map[string]string{
							*ruleSilence1.RuleUID: folder1,
							*ruleSilence2.RuleUID: folder2,
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
				})
			}
		})
	}
}

func TestAuthorizeUpdateSilence(t *testing.T) {
	global := testSilence{ID: "global", RuleUID: nil}
	ruleSilence1 := testSilence{ID: "rule-1", RuleUID: utils.Pointer("rule-1-uid")}
	folder1 := "rule-1-folder-uid"
	folder1Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder1)
	ruleSilence2 := testSilence{ID: "rule-2", RuleUID: utils.Pointer("rule-2-uid")}
	folder2 := "rule-2-folder-uid"
	folder2Scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2)
	notFoundRule := testSilence{ID: "unknown-rule", RuleUID: utils.Pointer("unknown-rule-uid")}

	silences := []testSilence{
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
		overrides        map[testSilence]override
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
			name: "instance read + silence write",
			user: newUser(ac.Permission{Action: silenceWrite, Scope: folder1Scope}, ac.Permission{Action: instancesRead}),
			overrides: map[testSilence]override{
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
			overrides: map[testSilence]override{
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
			name: "silence read + write",
			user: newUser(ac.Permission{Action: silenceRead, Scope: folder1Scope}, ac.Permission{Action: silenceWrite, Scope: folder1Scope}),
			overrides: map[testSilence]override{
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
				t.Run(silence.ID, func(t *testing.T) {
					ac := &recordingAccessControlFake{}
					store := &fakeRuleUIDToNamespaceStore{
						Response: map[string]string{
							*ruleSilence1.RuleUID: folder1,
							*ruleSilence2.RuleUID: folder2,
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
