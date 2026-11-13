package dashboard

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

// The table is written out by hand, so a path added to the schema without an entry would never merge.
func TestDashboardPreferencesFieldPathsMatchSchema(t *testing.T) {
	want := dashboardPreferencesSchemaResetPaths(t)
	slices.Sort(want)

	got := make([]string, 0, len(dashboardPreferencesFieldPaths))
	for _, path := range dashboardPreferencesFieldPaths {
		got = append(got, string(path))
	}
	slices.Sort(got)

	require.Equal(t, want, got)
}

func TestMergeDashboardPreferences(t *testing.T) {
	tier := func(kind dashboardPreferencesTier, name, spec string) dashboardPreferencesMergeTier {
		return dashboardPreferencesMergeTier{tier: kind, name: name, spec: dashboardPreferencesSpecFromJSON(t, spec)}
	}
	reset := func(source dashv2beta1.DashboardPreferencesMergedSource) dashv2beta1.DashboardPreferencesMergedSource {
		source.Reset = true
		return source
	}
	fromUser := dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierUser, Name: "user-u1"}
	fromFolder := dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierFolder, Name: "folder-c"}
	fromOrg := dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierOrg, Name: dashv2beta1.DashboardPreferencesOrgName}

	tests := []struct {
		name        string
		tiers       []dashboardPreferencesMergeTier
		wantSpec    string
		wantSources map[string]dashv2beta1.DashboardPreferencesMergedSource
	}{
		{
			name:        "no tiers",
			wantSpec:    `{}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{},
		},
		{
			name: "the highest tier that sets a field wins",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"dashboard":{"preload":false}}`),
				tier(dashboardPreferencesTierFolder, "folder-c", `{"dashboard":{"preload":true,"autoRefresh":"30s"}}`),
				tier(dashboardPreferencesTierFolder, "", `{"dashboard":{"cursorSync":"Crosshair","autoRefresh":"5m"}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"autoRefresh":"1m","timeRange":{"from":"now-6h","to":"now"}}}`),
			},
			wantSpec: `{"dashboard":{"preload":false,"autoRefresh":"30s","cursorSync":"Crosshair","timeRange":{"from":"now-6h","to":"now"}}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.preload":     fromUser,
				"dashboard.autoRefresh": fromFolder,
				"dashboard.cursorSync":  {Tier: dashv2beta1.DashboardPreferencesMergedTierFolder},
				"dashboard.timeRange":   fromOrg,
			},
		},
		{
			name: "false and 0 are values",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"dashboard":{"preload":false,"fiscalYearStartMonth":0}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"preload":true,"fiscalYearStartMonth":3}}`),
			},
			wantSpec: `{"dashboard":{"preload":false,"fiscalYearStartMonth":0}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.preload":              fromUser,
				"dashboard.fiscalYearStartMonth": fromUser,
			},
		},
		{
			name: "timeRange comes whole from one tier",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierFolder, "folder-c", `{"dashboard":{"timeRange":{"from":"now-1h","to":"now"}}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"timeRange":{"from":"now-7d","to":"now-1d"}}}`),
			},
			wantSpec: `{"dashboard":{"timeRange":{"from":"now-1h","to":"now"}}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.timeRange": fromFolder,
			},
		},
		{
			name: "each autoGrid member is its own field",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierFolder, "folder-c", `{"dashboard":{"autoGrid":{"columnWidth":300}}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"layout":"AutoGridLayout","autoGrid":{"columnWidth":200,"rowHeight":150}}}`),
			},
			wantSpec: `{"dashboard":{"layout":"AutoGridLayout","autoGrid":{"columnWidth":300,"rowHeight":150}}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.layout":               fromOrg,
				"dashboard.autoGrid.columnWidth": fromFolder,
				"dashboard.autoGrid.rowHeight":   fromOrg,
			},
		},
		{
			name: "a reset stops the cascade",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierFolder, "folder-c", `{"reset":["dashboard.timeRange"]}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"preload":true,"timeRange":{"from":"now-6h","to":"now"}}}`),
			},
			wantSpec: `{"dashboard":{"preload":true}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.preload":   fromOrg,
				"dashboard.timeRange": reset(fromFolder),
			},
		},
		{
			name: "a reset leaves no empty object",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"reset":["dashboard.autoGrid.columnWidth"]}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"autoGrid":{"columnWidth":200}}}`),
			},
			wantSpec: `{}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.autoGrid.columnWidth": reset(fromUser),
			},
		},
		{
			name: "a reset below a value has no effect",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"dashboard":{"preload":true}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"reset":["dashboard.preload"]}`),
			},
			wantSpec: `{"dashboard":{"preload":true}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.preload": fromUser,
			},
		},
		{
			name: "panel fields merge like dashboard fields",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"panels":{"legend":{"placement":"right"}}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"panels":{"legend":{"placement":"bottom","showLegend":true},"field":{"decimals":2}},"reset":["panels.tooltip.mode"]}`),
			},
			wantSpec: `{"panels":{"legend":{"placement":"right","showLegend":true},"field":{"decimals":2}}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"panels.legend.placement":  fromUser,
				"panels.legend.showLegend": fromOrg,
				"panels.field.decimals":    fromOrg,
				"panels.tooltip.mode":      reset(fromOrg),
			},
		},
		{
			name: "autoRefreshIntervals comes whole",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"dashboard":{"autoRefreshIntervals":["10s"]}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"autoRefreshIntervals":["1m","5m"]}}`),
			},
			wantSpec: `{"dashboard":{"autoRefreshIntervals":["10s"]}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.autoRefreshIntervals": fromUser,
			},
		},
		{
			name: "set and reset in one tier: the reset wins",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"preload":true},"reset":["dashboard.preload"]}`),
			},
			wantSpec: `{}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.preload": reset(fromOrg),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			merged, err := mergeDashboardPreferences(tt.tiers)
			require.NoError(t, err)

			require.Equal(t, tt.wantSources, merged.Sources)
			// Compares the whole encoding, so the no tiers row pins the response for nothing stored.
			encoded, err := json.Marshal(merged)
			require.NoError(t, err)
			sources, err := json.Marshal(tt.wantSources)
			require.NoError(t, err)
			require.JSONEq(t, `{"kind":"DashboardPreferencesMerged","apiVersion":"dashboard.grafana.app/v2beta1","spec":`+tt.wantSpec+`,"sources":`+string(sources)+`}`, string(encoded))
		})
	}
}

func TestMergeDashboardPreferencesEveryField(t *testing.T) {
	const everyField = `{"dashboard":{"preload":true,"autoRefresh":"1m","autoRefreshIntervals":["30s","1m"],"timeRange":{"from":"now-6h","to":"now"},"fiscalYearStartMonth":3,"nowDelay":"1m","hideTimepicker":true,"cursorSync":"Crosshair","layout":"AutoGridLayout","autoGrid":{"maxColumnCount":4,"columnWidthMode":"custom","columnWidth":300,"rowHeightMode":"custom","rowHeight":200,"fillScreen":true}},"panels":{"legend":{"showLegend":true,"placement":"right","displayMode":"table"},"tooltip":{"mode":"multi","sort":"desc","hideZeros":true},"axis":{"axisPlacement":"left","axisGridShow":true,"axisBorderShow":true,"axisCenteredZero":true,"scale":"log2"},"graph":{"lineInterpolation":"smooth","lineWidth":2,"fillOpacity":10,"gradientMode":"opacity","showPoints":"never","pointSize":5},"field":{"decimals":2},"frame":{"transparent":true}}}`
	fixture := dashboardPreferencesSpecFromJSON(t, everyField)
	paths := dashboardPreferencesSchemaResetPaths(t)

	encodedFixture := encodeDashboardPreferencesSpec(t, fixture)
	for _, path := range paths {
		require.True(t, isDashboardPreferencesFieldSet(encodedFixture, path), "the fixture doesn't set %s", path)
	}

	fromOrg := dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierOrg, Name: dashv2beta1.DashboardPreferencesOrgName}
	org := dashboardPreferencesMergeTier{tier: dashboardPreferencesTierOrg, name: dashv2beta1.DashboardPreferencesOrgName, spec: fixture}

	t.Run("every field from one tier", func(t *testing.T) {
		merged, err := mergeDashboardPreferences([]dashboardPreferencesMergeTier{org})
		require.NoError(t, err)

		spec, err := json.Marshal(merged.Spec)
		require.NoError(t, err)
		require.JSONEq(t, everyField, string(spec))
		require.Len(t, merged.Sources, len(paths))
		for _, path := range paths {
			require.Equal(t, fromOrg, merged.Sources[path], path)
		}
	})

	for _, path := range paths {
		t.Run("reset of "+path, func(t *testing.T) {
			merged, err := mergeDashboardPreferences([]dashboardPreferencesMergeTier{
				{
					tier: dashboardPreferencesTierUser,
					name: "user-u1",
					spec: dashv2beta1.DashboardPreferencesSpec{Reset: []dashv2beta1.DashboardPreferencesResetPath{dashv2beta1.DashboardPreferencesResetPath(path)}},
				},
				org,
			})
			require.NoError(t, err)

			encoded := encodeDashboardPreferencesSpec(t, merged.Spec)
			for _, other := range paths {
				require.Equal(t, other != path, isDashboardPreferencesFieldSet(encoded, other), other)
			}
			require.Equal(t, dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierUser, Name: "user-u1", Reset: true}, merged.Sources[path])
			require.Len(t, merged.Sources, len(paths))
		})
	}
}

func TestDashboardPreferencesMergedFolders(t *testing.T) {
	foldersGR := folders.FolderResourceInfo.GroupResource()
	nsCtx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	nsInfo, err := authlib.ParseNamespace("stacks-1")
	require.NoError(t, err)
	u1 := dashboardPreferencesRequester(authlib.TypeUser, "u1", identity.RoleViewer)
	get := []string{utils.VerbGet}

	long10 := make([]string, 0, 10)
	for i := range 10 {
		long10 = append(long10, fmt.Sprintf("long%d", i+1))
	}
	long10NearestFirst := slices.Clone(long10)
	slices.Reverse(long10NearestFirst)

	// What the folder API answers when it couldn't read c's top-level parent, gone.
	detachedChain := func() []folders.FolderInfo {
		chain := dashboardPreferencesFolderChain("gone", "p", "c")
		chain[0] = folders.FolderInfo{Name: "gone", Detached: true, Description: "Unable to read parent folder"}
		return chain
	}
	parentsGet := func(name string) dashboardPreferencesFolderGet {
		return dashboardPreferencesFolderGet{name: name, subresource: "parents", orgID: 1, callerOrgID: 1, callerNamespace: "stacks-1", serviceIdentity: true}
	}
	plainGet := func(name string) dashboardPreferencesFolderGet {
		call := parentsGet(name)
		call.subresource = ""
		return call
	}
	isAccessCheckError := func(err error) bool {
		var checkErr *accessCheckError
		return errors.As(err, &checkErr)
	}
	const ancestryLog = "dashboard preferences failed to read folder ancestry"

	tests := []struct {
		name   string
		folder string
		// Change the fakes from what every row starts with.
		accessClient func(*dashboardPreferencesAccessClient)
		parents      func(*dashboardPreferencesFolderParents)
		// The storage gets an untyped nil access client.
		noAccessClient bool
		// The caller is Grafana's service identity in place of u1.
		serviceIdentity bool

		want         []string
		wantErr      func(error) bool
		wantNotFound bool
		// The folder checked as the caller; empty for no check.
		wantCheck string
		wantGets  []dashboardPreferencesFolderGet
		// The message of the one log record; empty for no record.
		wantLog       string
		wantLoggedErr string
	}{
		{name: "no folder is the top level", folder: ""},
		{name: "general is the top level", folder: "general"},

		{name: "shared with me", folder: "sharedwithme", wantErr: apierrors.IsBadRequest},
		{name: "a UID that makes an invalid tier name", folder: "has space", wantErr: apierrors.IsBadRequest},
		{name: "dot", folder: ".", wantErr: apierrors.IsBadRequest},
		{name: "dot dot", folder: "..", wantErr: apierrors.IsBadRequest},

		{name: "a folder the caller can't read", folder: "g", wantErr: apierrors.IsForbidden, wantCheck: "g"},
		{name: "an unknown folder the caller can't read", folder: "nope", wantErr: apierrors.IsForbidden, wantCheck: "nope"},
		{
			name:         "an unknown folder the caller can read",
			folder:       "x",
			wantErr:      func(err error) bool { return isNotFoundForObject(err, foldersGR, "x") },
			wantNotFound: true,
			wantCheck:    "x",
			wantGets:     []dashboardPreferencesFolderGet{parentsGet("x")},
		},

		{name: "a top-level folder", folder: "top", want: []string{"top"}, wantCheck: "top", wantGets: []dashboardPreferencesFolderGet{parentsGet("top")}},
		{name: "a nested folder", folder: "c", want: []string{"c", "p", "g"}, wantCheck: "c", wantGets: []dashboardPreferencesFolderGet{parentsGet("c")}},
		{name: "a chain deeper than creation allows", folder: "long10", want: long10NearestFirst, wantCheck: "long10", wantGets: []dashboardPreferencesFolderGet{parentsGet("long10")}},

		{
			name:   "parents forbidden to the service identity",
			folder: "c",
			parents: func(p *dashboardPreferencesFolderParents) {
				p.parentsErr = apierrors.NewForbidden(foldersGR, "c", errors.New("boom"))
			},
			wantErr:       apierrors.IsInternalError,
			wantCheck:     "c",
			wantGets:      []dashboardPreferencesFolderGet{parentsGet("c")},
			wantLog:       ancestryLog,
			wantLoggedErr: "boom",
		},
		{
			name:          "parents unauthorized for the service identity",
			folder:        "c",
			parents:       func(p *dashboardPreferencesFolderParents) { p.parentsErr = apierrors.NewUnauthorized("boom") },
			wantErr:       apierrors.IsInternalError,
			wantCheck:     "c",
			wantGets:      []dashboardPreferencesFolderGet{parentsGet("c")},
			wantLog:       ancestryLog,
			wantLoggedErr: "boom",
		},
		{
			name:          "parents failed",
			folder:        "c",
			parents:       func(p *dashboardPreferencesFolderParents) { p.parentsErr = errors.New("boom") },
			wantErr:       apierrors.IsInternalError,
			wantCheck:     "c",
			wantGets:      []dashboardPreferencesFolderGet{parentsGet("c")},
			wantLog:       ancestryLog,
			wantLoggedErr: "boom",
		},
		{
			// What client-go builds from a 404 that isn't a Status, such as one for an unserved path.
			name:   "parents NotFound that names nothing",
			folder: "c",
			parents: func(p *dashboardPreferencesFolderParents) {
				p.parentsErr = apierrors.NewGenericServerResponse(http.StatusNotFound, "GET", schema.GroupResource{}, "", "", 0, true)
			},
			wantErr:   apierrors.IsInternalError,
			wantCheck: "c",
			wantGets:  []dashboardPreferencesFolderGet{parentsGet("c")},
			wantLog:   ancestryLog,
		},
		{
			name:      "parents NotFound for another folder",
			folder:    "c",
			parents:   func(p *dashboardPreferencesFolderParents) { p.parentsErr = apierrors.NewNotFound(foldersGR, "other") },
			wantErr:   apierrors.IsInternalError,
			wantCheck: "c",
			wantGets:  []dashboardPreferencesFolderGet{parentsGet("c")},
			wantLog:   ancestryLog,
		},
		{
			name:      "parents that don't end with the folder",
			folder:    "c",
			parents:   func(p *dashboardPreferencesFolderParents) { p.chains["c"] = dashboardPreferencesFolderChain("g", "p") },
			wantErr:   apierrors.IsInternalError,
			wantCheck: "c",
			wantGets:  []dashboardPreferencesFolderGet{parentsGet("c")},
			wantLog:   ancestryLog,
		},
		{
			name:      "no parents at all",
			folder:    "c",
			parents:   func(p *dashboardPreferencesFolderParents) { p.chains["c"] = []folders.FolderInfo{} },
			wantErr:   apierrors.IsInternalError,
			wantCheck: "c",
			wantGets:  []dashboardPreferencesFolderGet{parentsGet("c")},
			wantLog:   ancestryLog,
		},

		{
			name:   "a missing top-level parent ends the ancestry",
			folder: "c",
			parents: func(p *dashboardPreferencesFolderParents) {
				p.chains["c"] = detachedChain()
				p.getErrs = map[string]error{"gone": apierrors.NewNotFound(foldersGR, "gone")}
			},
			want:      []string{"c", "p"},
			wantCheck: "c",
			wantGets:  []dashboardPreferencesFolderGet{parentsGet("c"), plainGet("gone")},
		},
		{
			name:      "a detached parent that reads on the second attempt",
			folder:    "c",
			parents:   func(p *dashboardPreferencesFolderParents) { p.chains["c"] = detachedChain() },
			wantErr:   apierrors.IsInternalError,
			wantCheck: "c",
			wantGets:  []dashboardPreferencesFolderGet{parentsGet("c"), plainGet("gone")},
			wantLog:   ancestryLog,
		},
		{
			name:   "a detached parent that fails the second attempt",
			folder: "c",
			parents: func(p *dashboardPreferencesFolderParents) {
				p.chains["c"] = detachedChain()
				p.getErrs = map[string]error{"gone": errors.New("boom")}
			},
			wantErr:       apierrors.IsInternalError,
			wantCheck:     "c",
			wantGets:      []dashboardPreferencesFolderGet{parentsGet("c"), plainGet("gone")},
			wantLog:       ancestryLog,
			wantLoggedErr: "boom",
		},
		{
			name:   "a detached parent whose second attempt is a NotFound for another folder",
			folder: "c",
			parents: func(p *dashboardPreferencesFolderParents) {
				p.chains["c"] = detachedChain()
				p.getErrs = map[string]error{"gone": apierrors.NewNotFound(foldersGR, "other")}
			},
			wantErr:   apierrors.IsInternalError,
			wantCheck: "c",
			wantGets:  []dashboardPreferencesFolderGet{parentsGet("c"), plainGet("gone")},
			wantLog:   ancestryLog,
		},

		{
			name:          "a failed folder access check",
			folder:        "c",
			accessClient:  func(c *dashboardPreferencesAccessClient) { c.checkErrs = map[string]error{"c": errors.New("boom")} },
			wantErr:       isAccessCheckError,
			wantCheck:     "c",
			wantLog:       "dashboard preferences failed to check folder access",
			wantLoggedErr: "boom",
		},
		{name: "no access client", folder: "c", noAccessClient: true, wantErr: apierrors.IsForbidden},
		{
			name:            "the service identity as the caller",
			folder:          "c",
			serviceIdentity: true,
			want:            []string{"c", "p", "g"},
			wantCheck:       "c",
			wantGets:        []dashboardPreferencesFolderGet{parentsGet("c")},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			accessClient := &dashboardPreferencesAccessClient{grants: map[string][]string{"c": get, "p": get, "x": get, "top": get, "long10": get}}
			if tt.accessClient != nil {
				tt.accessClient(accessClient)
			}
			var checker authlib.AccessClient = accessClient
			if tt.noAccessClient {
				checker = nil
			}
			parents := &dashboardPreferencesFolderParents{chains: map[string][]folders.FolderInfo{
				"c":      dashboardPreferencesFolderChain("g", "p", "c"),
				"top":    dashboardPreferencesFolderChain("top"),
				"long10": dashboardPreferencesFolderChain(long10...),
			}}
			if tt.parents != nil {
				tt.parents(parents)
			}
			store := newDashboardPreferencesStorage(newDashboardPreferencesListStore(t, nil), dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind(),
				checker, nil, &staticHandlerProvider{handler: parents})

			var requester identity.Requester = u1
			ctx := identity.WithRequester(nsCtx, u1)
			if tt.serviceIdentity {
				ctx, requester = identity.WithServiceIdentity(nsCtx, 1)
			}
			var logs bytes.Buffer
			ctx = logging.Context(ctx, logging.NewSLogLogger(slog.NewJSONHandler(&logs, nil)))

			got, err := store.mergedFolders(ctx, requester, nsInfo, tt.folder)

			if tt.wantErr != nil {
				require.Error(t, err)
				require.True(t, tt.wantErr(err), "unexpected error: %v", err)
				// Only a folder the caller can read is told apart from a missing one.
				require.Equal(t, tt.wantNotFound, apierrors.IsNotFound(err), "unexpected error: %v", err)
				// The apiserver sends the error's text to the client.
				require.NotContains(t, err.Error(), "boom")
				require.Nil(t, got)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.want, got)
			}

			if tt.wantCheck == "" {
				require.Empty(t, accessClient.requests)
			} else {
				require.Equal(t, []string{requester.GetUID()}, accessClient.callers)
				require.Len(t, accessClient.requests, 1)
				require.Equal(t, tt.wantCheck, accessClient.requests[0].Name)
				require.Equal(t, utils.VerbGet, accessClient.requests[0].Verb)
			}
			require.Equal(t, tt.wantGets, parents.gets)

			if tt.wantLog == "" {
				require.Empty(t, logs.String())
				return
			}
			var record map[string]any
			require.NoError(t, json.Unmarshal(logs.Bytes(), &record), "expected one log record, got %s", logs.String())
			require.Equal(t, "ERROR", record["level"])
			require.Equal(t, tt.wantLog, record["msg"])
			require.Equal(t, "stacks-1", record["namespace"])
			require.Equal(t, tt.folder, record["folder"])
			require.NotEmpty(t, record["err"])
			require.Contains(t, record["err"], tt.wantLoggedErr)
		})
	}
}

// Decodes strictly, so a misspelled key in a fixture fails the test instead of leaving the field unset.
func dashboardPreferencesSpecFromJSON(t *testing.T, s string) dashv2beta1.DashboardPreferencesSpec {
	t.Helper()
	decoder := json.NewDecoder(strings.NewReader(s))
	decoder.DisallowUnknownFields()
	var spec dashv2beta1.DashboardPreferencesSpec
	require.NoError(t, decoder.Decode(&spec))
	return spec
}

func dashboardPreferencesSchemaResetPaths(t *testing.T) []string {
	t.Helper()
	specSchema, err := dashboardPreferencesSpecSchema()
	require.NoError(t, err)
	enum := specSchema.Properties["reset"].Value.Items.Value.Enum
	paths := make([]string, 0, len(enum))
	for _, value := range enum {
		paths = append(paths, value.(string))
	}
	return paths
}

// encodeDashboardPreferencesSpec returns spec as admission sees it, in which an unset field is absent.
func encodeDashboardPreferencesSpec(t *testing.T, spec any) any {
	t.Helper()
	raw, err := json.Marshal(spec)
	require.NoError(t, err)
	var encoded any
	require.NoError(t, json.Unmarshal(raw, &encoded))
	return encoded
}

// dashboardPreferencesFolderParents answers the folder API's parents subresource from each folder's chain,
// top level first as the folder API orders it, and a plain get from getErrs. It records every get.
type dashboardPreferencesFolderParents struct {
	client.K8sHandler
	// A missing key is a folder that doesn't exist.
	chains map[string][]folders.FolderInfo
	// Returned by every parents get in place of an answer.
	parentsErr error
	// Returned by the plain get of the folder it names; a missing key is a folder that exists.
	getErrs map[string]error
	gets    []dashboardPreferencesFolderGet
}

type dashboardPreferencesFolderGet struct {
	name, subresource, callerNamespace string
	orgID, callerOrgID                 int64
	serviceIdentity                    bool
}

func (p *dashboardPreferencesFolderParents) Get(ctx context.Context, name string, orgID int64, _ metav1.GetOptions, subresource ...string) (*unstructured.Unstructured, error) {
	call := dashboardPreferencesFolderGet{name: name, subresource: strings.Join(subresource, "/"), orgID: orgID, serviceIdentity: identity.IsServiceIdentity(ctx)}
	if requester, err := identity.GetRequester(ctx); err == nil {
		call.callerNamespace = requester.GetNamespace()
		call.callerOrgID = requester.GetOrgID()
	}
	p.gets = append(p.gets, call)

	if call.subresource == "" {
		if err := p.getErrs[name]; err != nil {
			return nil, err
		}
		obj := &unstructured.Unstructured{}
		obj.SetName(name)
		return obj, nil
	}

	if p.parentsErr != nil {
		return nil, p.parentsErr
	}
	chain, ok := p.chains[name]
	if !ok {
		return nil, apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), name)
	}
	obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&folders.FolderInfoList{Items: chain})
	if err != nil {
		return nil, err
	}
	return &unstructured.Unstructured{Object: obj}, nil
}

// dashboardPreferencesFolderChain returns the folders top level first, each the parent of the next.
func dashboardPreferencesFolderChain(uids ...string) []folders.FolderInfo {
	chain := make([]folders.FolderInfo, 0, len(uids))
	parent := ""
	for _, uid := range uids {
		chain = append(chain, folders.FolderInfo{Name: uid, Title: uid, Parent: parent})
		parent = uid
	}
	return chain
}
