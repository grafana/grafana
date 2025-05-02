package api

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	folder2 "github.com/grafana/grafana/pkg/services/folder"
	. "github.com/grafana/grafana/pkg/services/ngalert/api/compat"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
)

//go:embed test-data/*.*
var testData embed.FS

func TestExportFromPayload(t *testing.T) {
	orgID := int64(1)
	folder := &folder2.Folder{
		UID:      "e4584834-1a87-4dff-8913-8a4748dfca79",
		Title:    "foo bar",
		Fullpath: "foo bar",
	}

	ruleStore := fakes.NewRuleStore(t)
	ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)

	srv := createService(ruleStore, nil)

	requestFile := "post-rulegroup-101.json"
	rawBody, err := testData.ReadFile(path.Join("test-data", requestFile))
	require.NoError(t, err)
	// compact the json to remove any extra whitespace
	var buf bytes.Buffer
	require.NoError(t, json.Compact(&buf, rawBody))
	// unmarshal the compacted json
	var body apimodels.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(buf.Bytes(), &body))

	createRequest := func() *contextmodel.ReqContext {
		return createRequestContextWithPerms(orgID, map[int64]map[string][]string{}, nil)
	}

	t.Run("accept header contains yaml, GET returns text yaml", func(t *testing.T) {
		rc := createRequest()
		rc.Req.Header.Add("Accept", "application/yaml")

		response := srv.ExportFromPayload(rc, body, folder.UID)

		response.WriteTo(rc)

		require.Equal(t, 200, response.Status())
		require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
	})

	t.Run("query format contains yaml, GET returns text yaml", func(t *testing.T) {
		rc := createRequest()
		rc.Req.Form.Set("format", "yaml")

		response := srv.ExportFromPayload(rc, body, folder.UID)
		response.WriteTo(rc)

		require.Equal(t, 200, response.Status())
		require.Equal(t, "text/yaml", rc.Resp.Header().Get("Content-Type"))
	})

	t.Run("query format contains unknown value, GET returns text yaml", func(t *testing.T) {
		rc := createRequest()
		rc.Req.Form.Set("format", "foo")

		response := srv.ExportFromPayload(rc, body, folder.UID)
		response.WriteTo(rc)

		require.Equal(t, 200, response.Status())
		require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
	})

	t.Run("accept header contains json, GET returns json", func(t *testing.T) {
		rc := createRequest()
		rc.Req.Header.Add("Accept", "application/json")

		response := srv.ExportFromPayload(rc, body, folder.UID)
		response.WriteTo(rc)

		require.Equal(t, 200, response.Status())
		require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
	})

	t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
		rc := createRequest()
		rc.Req.Header.Add("Accept", "application/json, application/yaml")

		response := srv.ExportFromPayload(rc, body, folder.UID)
		response.WriteTo(rc)

		require.Equal(t, 200, response.Status())
		require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
	})

	t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
		rc := createRequest()
		rc.Req.Form.Set("download", "true")

		response := srv.ExportFromPayload(rc, body, folder.UID)
		response.WriteTo(rc)

		require.Equal(t, 200, response.Status())
		require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
	})

	t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
		rc := createRequest()
		rc.Req.Form.Set("download", "false")

		response := srv.ExportFromPayload(rc, body, folder.UID)
		response.WriteTo(rc)

		require.Equal(t, 200, response.Status())
		require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
	})

	t.Run("query param download not set, GET returns empty content disposition", func(t *testing.T) {
		rc := createRequest()

		response := srv.ExportFromPayload(rc, body, folder.UID)
		response.WriteTo(rc)

		require.Equal(t, 200, response.Status())
		require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
	})

	t.Run("json body content is as expected", func(t *testing.T) {
		expectedResponse, err := testData.ReadFile(path.Join("test-data", strings.Replace(requestFile, ".json", "-export.json", 1)))
		require.NoError(t, err)

		rc := createRequest()
		rc.Req.Header.Add("Accept", "application/json")

		response := srv.ExportFromPayload(rc, body, folder.UID)
		response.WriteTo(rc)
		t.Log(string(response.Body()))

		require.Equal(t, 200, response.Status())
		require.JSONEq(t, string(expectedResponse), string(response.Body()))
	})

	t.Run("yaml body content is as expected", func(t *testing.T) {
		expectedResponse, err := testData.ReadFile(path.Join("test-data", strings.Replace(requestFile, ".json", "-export.yaml", 1)))
		require.NoError(t, err)

		rc := createRequest()
		rc.Req.Header.Add("Accept", "application/yaml")

		response := srv.ExportFromPayload(rc, body, folder.UID)
		response.WriteTo(rc)
		require.Equal(t, 200, response.Status())
		require.Equal(t, string(expectedResponse), string(response.Body()))
	})

	t.Run("hcl body content is as expected", func(t *testing.T) {
		expectedResponse, err := testData.ReadFile(path.Join("test-data", strings.Replace(requestFile, ".json", "-export.hcl", 1)))
		require.NoError(t, err)

		rc := createRequest()
		rc.Req.Form.Set("format", "hcl")
		rc.Req.Form.Set("download", "false")

		response := srv.ExportFromPayload(rc, body, folder.UID)
		response.WriteTo(rc)

		require.Equal(t, 200, response.Status())
		require.Equal(t, string(expectedResponse), string(response.Body()))
		require.Equal(t, "text/hcl", rc.Resp.Header().Get("Content-Type"))

		t.Run("and add specific headers if download=true", func(t *testing.T) {
			rc := createRequest()
			rc.Req.Form.Set("format", "hcl")
			rc.Req.Form.Set("download", "true")

			response := srv.ExportFromPayload(rc, body, folder.UID)
			response.WriteTo(rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, string(expectedResponse), string(response.Body()))
			require.Equal(t, "application/terraform+hcl", rc.Resp.Header().Get("Content-Type"))
			require.Equal(t, `attachment;filename=export.tf`, rc.Resp.Header().Get("Content-Disposition"))
		})
	})
}

func TestExportRules(t *testing.T) {
	orgID := int64(1)
	f1 := randFolder()
	f2 := randFolder()

	ruleStore := fakes.NewRuleStore(t)

	hasAccessKey1 := ngmodels.AlertRuleGroupKey{
		OrgID:        orgID,
		NamespaceUID: f1.UID,
		RuleGroup:    "HAS-ACCESS-1",
	}

	gen := ngmodels.RuleGen
	accessQuery := gen.GenerateQuery()
	noAccessQuery := gen.GenerateQuery()
	mdl := map[string]any{
		"foo": "bar",
		"baz": "a <=> b", // explicitly check greater/less than characters
	}
	model, err := json.Marshal(mdl)
	require.NoError(t, err)
	accessQuery.Model = model

	hasAccess1 := gen.With(gen.WithGroupKey(hasAccessKey1), gen.WithQuery(accessQuery), gen.WithUniqueGroupIndex()).GenerateManyRef(5)
	ruleStore.PutRule(context.Background(), hasAccess1...)
	noAccessKey1 := ngmodels.AlertRuleGroupKey{
		OrgID:        orgID,
		NamespaceUID: f1.UID,
		RuleGroup:    "NO-ACCESS",
	}
	noAccess1 := gen.With(gen.WithGroupKey(noAccessKey1), gen.WithQuery(noAccessQuery)).GenerateManyRef(5)
	noAccessRule := gen.With(gen.WithGroupKey(noAccessKey1), gen.WithQuery(accessQuery)).GenerateRef()
	noAccess1 = append(noAccess1, noAccessRule)
	ruleStore.PutRule(context.Background(), noAccess1...)

	hasAccessKey2 := ngmodels.AlertRuleGroupKey{
		OrgID:        orgID,
		NamespaceUID: f2.UID,
		RuleGroup:    "HAS-ACCESS-2",
	}
	hasAccess2 := gen.With(gen.WithGroupKey(hasAccessKey2), gen.WithQuery(accessQuery), gen.WithUniqueGroupIndex()).GenerateManyRef(5)
	ruleStore.PutRule(context.Background(), hasAccess2...)

	noAccessByFolder := gen.With(gen.WithQuery(accessQuery), gen.WithNamespaceUIDNotIn(f1.UID, f2.UID)).GenerateManyRef(10)

	ruleStore.PutRule(context.Background(), noAccessByFolder...)
	// overwrite the folders visible to user because PutRule automatically creates folders in the fake store.
	ruleStore.Folders[orgID] = []*folder2.Folder{f1, f2}

	srv := createService(ruleStore, nil)

	allRules := make([]*ngmodels.AlertRule, 0, len(hasAccess1)+len(hasAccess2)+len(noAccess1))
	allRules = append(allRules, hasAccess1...)
	allRules = append(allRules, hasAccess2...)
	allRules = append(allRules, noAccess1...)

	testCases := []struct {
		title           string
		params          url.Values
		headers         http.Header
		expectedStatus  int
		expectedHeaders http.Header
		expectedRules   []*ngmodels.AlertRule
	}{
		{
			title:          "return all rules user has access to when no parameters",
			expectedStatus: 200,
			expectedHeaders: http.Header{
				"Content-Type": []string{"text/yaml"},
			},
			expectedRules: allRules,
		},
		{
			title: "return all rules in folder",
			params: url.Values{
				"folderUid": []string{hasAccessKey1.NamespaceUID},
			},
			expectedStatus: 200,
			expectedHeaders: http.Header{
				"Content-Type": []string{"text/yaml"},
			},
			expectedRules: append(hasAccess1, noAccess1...),
		},
		{
			title: "return all rules in many folders",
			params: url.Values{
				"folderUid": []string{hasAccessKey1.NamespaceUID, hasAccessKey2.NamespaceUID},
			},
			expectedStatus: 200,
			expectedHeaders: http.Header{
				"Content-Type": []string{"text/yaml"},
			},
			expectedRules: allRules,
		},
		{
			title: "return rules in single group",
			params: url.Values{
				"folderUid": []string{hasAccessKey1.NamespaceUID},
				"group":     []string{hasAccessKey1.RuleGroup},
			},
			expectedStatus: 200,
			expectedHeaders: http.Header{
				"Content-Type": []string{"text/yaml"},
			},
			expectedRules: hasAccess1,
		},
		{
			title: "return single rule",
			params: url.Values{
				"ruleUid": []string{hasAccess1[0].UID},
			},
			expectedStatus: 200,
			expectedHeaders: http.Header{
				"Content-Type": []string{"text/yaml"},
			},
			expectedRules: []*ngmodels.AlertRule{hasAccess1[0]},
		},
		{
			title: "fail if group and many folders",
			params: url.Values{
				"folderUid": []string{hasAccessKey1.NamespaceUID, hasAccessKey2.NamespaceUID},
				"group":     []string{hasAccessKey1.RuleGroup},
			},
			expectedStatus: 400,
		},
		{
			title: "fail if ruleUid and group",
			params: url.Values{
				"folderUid": []string{hasAccessKey1.NamespaceUID},
				"group":     []string{hasAccessKey1.RuleGroup},
				"ruleUid":   []string{hasAccess1[0].UID},
			},
			expectedStatus: 400,
		},
		{
			title: "fail if ruleUid and folderUid",
			params: url.Values{
				"folderUid": []string{hasAccessKey1.NamespaceUID},
				"ruleUid":   []string{hasAccess1[0].UID},
			},
			expectedStatus: 400,
		},
		{
			title: "forbidden if folders are not accessible",
			params: url.Values{
				"folderUid": []string{noAccessByFolder[0].NamespaceUID},
			},
			expectedStatus: http.StatusForbidden,
			expectedRules:  nil,
		},
		{
			title: "return in JSON if header is specified",
			headers: http.Header{
				"Accept": []string{"application/json"},
			},
			expectedStatus: 200,
			expectedRules:  allRules,
			expectedHeaders: http.Header{
				"Content-Type": []string{"application/json"},
			},
		},
		{
			title: "return in JSON if format is specified",
			params: url.Values{
				"format": []string{"json"},
			},
			expectedStatus: 200,
			expectedRules:  allRules,
			expectedHeaders: http.Header{
				"Content-Type": []string{"application/json"},
			},
		},
		{
			title: "return in HCL if format is specified",
			params: url.Values{
				"format": []string{"hcl"},
			},
			expectedStatus: 200,
			expectedRules:  allRules,
			expectedHeaders: http.Header{
				"Content-Type": []string{"text/hcl"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.title, func(t *testing.T) {
			rc := createRequestContextWithPerms(orgID, map[int64]map[string][]string{
				orgID: {
					dashboards.ActionFoldersRead:         []string{dashboards.ScopeFoldersProvider.GetResourceScopeUID(f1.UID), dashboards.ScopeFoldersProvider.GetResourceScopeUID(f2.UID)},
					accesscontrol.ActionAlertingRuleRead: []string{dashboards.ScopeFoldersProvider.GetResourceScopeUID(f1.UID), dashboards.ScopeFoldersProvider.GetResourceScopeUID(f2.UID)},
					datasources.ActionQuery:              []string{datasources.ScopeProvider.GetResourceScopeUID(accessQuery.DatasourceUID)},
				},
			}, nil)
			rc.Req.Form = tc.params
			rc.Req.Header = tc.headers

			resp := srv.ExportRules(rc)

			require.Equal(t, tc.expectedStatus, resp.Status())
			if tc.expectedStatus != 200 {
				return
			}
			var exp []ngmodels.AlertRuleGroupWithFolderFullpath
			gr := ngmodels.GroupByAlertRuleGroupKey(tc.expectedRules)
			for key, rules := range gr {
				folder, err := ruleStore.GetNamespaceByUID(context.Background(), key.NamespaceUID, orgID, nil)
				require.NoError(t, err)
				exp = append(exp, ngmodels.NewAlertRuleGroupWithFolderFullpathFromRulesGroup(key, rules, folder.Fullpath))
			}
			sort.SliceStable(exp, func(i, j int) bool {
				gi, gj := exp[i], exp[j]
				if gi.OrgID != gj.OrgID {
					return gi.OrgID < gj.OrgID
				}
				if gi.FolderUID != gj.FolderUID {
					return gi.FolderUID < gj.FolderUID
				}
				return gi.Title < gj.Title
			})
			groups, err := AlertingFileExportFromAlertRuleGroupWithFolderFullpath(exp)
			require.NoError(t, err)

			require.Equal(t, string(exportResponse(rc, groups).Body()), string(resp.Body()))

			resp.WriteTo(rc)
			actualHeaders := rc.Resp.Header()
			for h, hv := range tc.expectedHeaders {
				assert.Contains(t, actualHeaders, h)
				actual := actualHeaders[h]
				require.Equal(t, hv, actual)
			}
		})
	}
}
