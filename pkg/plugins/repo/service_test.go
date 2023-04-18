package repo

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetPluginArchive(t *testing.T) {
	tcs := []struct {
		name string
		sha  string
		err  error
	}{
		{
			name: "Happy path",
			sha:  "ddb1356593bc0c7e6c0fc5d8be5d161793405cc16cca1dcd5ca7541e55c58f15",
		},
		{
			name: "Incorrect SHA returns error",
			sha:  "1a2b3c",
			err:  errors.New("failed to download plugin archive: expected SHA256 checksum does not match the downloaded archive - please contact security@grafana.com"),
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			const (
				pluginID       = "grafana-test-datasource"
				version        = "1.0.2"
				opSys          = "darwin"
				arch           = "amd64"
				grafanaVersion = "10.0.0"
			)

			pluginZip := createPluginArchive(t)
			t.Cleanup(func() {
				err := pluginZip.Close()
				require.NoError(t, err)
				err = os.RemoveAll(pluginZip.Name())
				require.NoError(t, err)
			})

			d, err := os.ReadFile(pluginZip.Name())
			require.NoError(t, err)

			srv := createFakeServer(t,
				srvData{
					pluginID: pluginID,
					version:  version,
					opSys:    opSys,
					arch:     arch,
					sha:      tc.sha,
					archive:  d,
				},
			)

			m := New(Cfg{BaseURL: srv.URL}, &fakeLogger{})
			archive, err := m.GetPluginArchive(context.Background(), pluginID, version, CompatOpts{
				GrafanaVersion: grafanaVersion,
				OS:             opSys,
				Arch:           arch,
			})
			if tc.err != nil {
				require.EqualError(t, err, tc.err.Error())
				return
			}
			require.NoError(t, err)
			require.NotNil(t, archive)
		})
	}

	t.Run("Wildcard Grafana version", func(t *testing.T) {
		const (
			pluginID       = "grafana-test-datasource"
			version        = "1.0.2"
			opSys          = "darwin"
			arch           = "amd64"
			grafanaVersion = "*"
			sha            = "ddb1356593bc0c7e6c0fc5d8be5d161793405cc16cca1dcd5ca7541e55c58f15"
		)

		pluginZip := createPluginArchive(t)
		t.Cleanup(func() {
			err := pluginZip.Close()
			require.NoError(t, err)
			err = os.RemoveAll(pluginZip.Name())
			require.NoError(t, err)
		})

		d, err := os.ReadFile(pluginZip.Name())
		require.NoError(t, err)

		srv := createFakeServer(t,
			srvData{
				pluginID:       pluginID,
				version:        version,
				opSys:          opSys,
				arch:           arch,
				sha:            sha,
				grafanaVersion: grafanaVersion,
				archive:        d,
			},
		)

		m := New(Cfg{BaseURL: srv.URL}, &fakeLogger{})
		archive, err := m.GetPluginArchive(context.Background(), pluginID, version, CompatOpts{
			GrafanaVersion: grafanaVersion,
			OS:             opSys,
			Arch:           arch,
		})

		require.NoError(t, err)
		require.NotNil(t, archive)
	})
}

func TestSelectVersion(t *testing.T) {
	i := &Manager{log: &fakeLogger{}}

	t.Run("Should return error when requested version does not exist", func(t *testing.T) {
		_, err := i.selectVersion(createPluginVersions(versionArg{version: "version"}), "test", "1.1.1", CompatOpts{})
		require.Error(t, err)
	})

	t.Run("Should return error when no version supports current arch", func(t *testing.T) {
		_, err := i.selectVersion(createPluginVersions(versionArg{version: "version", arch: []string{"non-existent"}}), "test", "", CompatOpts{})
		require.Error(t, err)
	})

	t.Run("Should return error when requested version does not support current arch", func(t *testing.T) {
		_, err := i.selectVersion(createPluginVersions(
			versionArg{version: "2.0.0"},
			versionArg{version: "1.1.1", arch: []string{"non-existent"}},
		), "test", "1.1.1", CompatOpts{})
		require.Error(t, err)
	})

	t.Run("Should return latest available for arch when no version specified", func(t *testing.T) {
		ver, err := i.selectVersion(createPluginVersions(
			versionArg{version: "2.0.0", arch: []string{"non-existent"}},
			versionArg{version: "1.0.0"},
		), "test", "", CompatOpts{})
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})

	t.Run("Should return latest version when no version specified", func(t *testing.T) {
		ver, err := i.selectVersion(createPluginVersions(versionArg{version: "2.0.0"}, versionArg{version: "1.0.0"}), "test", "", CompatOpts{})
		require.NoError(t, err)
		require.Equal(t, "2.0.0", ver.Version)
	})

	t.Run("Should return requested version", func(t *testing.T) {
		ver, err := i.selectVersion(createPluginVersions(versionArg{version: "2.0.0"}, versionArg{version: "1.0.0"}), "test", "1.0.0", CompatOpts{})
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})
}

func createPluginArchive(t *testing.T) *os.File {
	t.Helper()

	pluginZip, err := os.CreateTemp(os.TempDir(), "*.zip")
	require.NoError(t, err)

	zipWriter := zip.NewWriter(pluginZip)
	pJSON, err := zipWriter.Create("plugin.json")
	require.NoError(t, err)
	_, err = pJSON.Write([]byte(`{}`))
	require.NoError(t, err)
	err = zipWriter.Close()
	require.NoError(t, err)

	return pluginZip
}

type srvData struct {
	pluginID       string
	version        string
	opSys          string
	arch           string
	sha            string
	grafanaVersion string
	archive        []byte
}

func createFakeServer(t *testing.T, data srvData) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()

	// mock plugin version data
	mux.HandleFunc(fmt.Sprintf("/repo/%s", data.pluginID), func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, data.grafanaVersion, r.Header.Get("grafana-version"))
		require.Equal(t, data.opSys, r.Header.Get("grafana-os"))
		require.Equal(t, data.arch, r.Header.Get("grafana-arch"))
		require.NotNil(t, fmt.Sprintf("grafana %s", data.grafanaVersion), r.Header.Get("User-Agent"))

		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")

		_, _ = w.Write([]byte(fmt.Sprintf(`
				{
					"versions": [{
						"version": "%s",
						"arch": {
							"%s-%s": {
								"sha256": "%s"
							}
						}
					}]
				}
			`, data.version, data.opSys, data.arch, data.sha),
		))
	})

	// mock plugin archive
	mux.HandleFunc(fmt.Sprintf("/%s/version/%s/download", data.pluginID, data.version), func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(data.archive)
	})

	return httptest.NewServer(mux)
}

func createFakeServerV2(t *testing.T, data srvData) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()

	// mock plugin data
	mux.HandleFunc(fmt.Sprintf("/%s", data.pluginID), func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")

		_, _ = w.Write([]byte(fmt.Sprintf(`
				{
					"status": "active",
					"id": 663,
					"typeId": 2,
					"typeName": "Data Source",
					"typeCode": "datasource",
					"slug": "grafana-github-datasource",
					"name": "GitHub",
					"description": "Show data about github issues/pull requests",
					"version": "1.4.3",
					"versionStatus": "active",
					"versionSignatureType": "grafana",
					"versionSignedByOrg": "grafana",
					"versionSignedByOrgName": "Grafana Labs",
					"userId": 0,
					"orgId": 5000,
					"orgName": "Grafana Labs",
					"orgSlug": "grafana",
					"orgUrl": "https://grafana.org",
					"url": "https://github.com/grafana/github-datasource/",
					"createdAt": "2020-09-11T04:02:59.000Z",
					"updatedAt": "2023-03-07T11:02:09.000Z",
					"json": {},
					"readme": "<h1>Grafana GitHub datasource</h1>\n<p>The GitHub datasource allows GitHub API data to be visually represented in Grafana dashboards.</p>\n<h2>GitHub API V4 (GraphQL)</h2>\n<p>This datasource uses the <a href=\"https://github.com/shurcooL/githubv4\" target=\"_blank\"><code>githubv4</code> package</a>, which is under active development.</p>\n<h2>Features</h2>\n<h3>Backend</h3>\n<ul>\n<li>[x] Releases</li>\n<li>[x] Commits</li>\n<li>[x] Repositories</li>\n<li>[x] Stargazers</li>\n<li>[x] Issues</li>\n<li>[x] Organizations</li>\n<li>[x] Labels</li>\n<li>[x] Milestones</li>\n<li>[x] Response Caching</li>\n<li>[x] Projects</li>\n<li>[ ] Deploys</li>\n</ul>\n<h3>Frontend</h3>\n<ul>\n<li>[x] Visualize queries</li>\n<li>[x] Template variables</li>\n<li>[x] Annotations</li>\n</ul>\n<h2>Caching</h2>\n<p>Caching on this plugin is always enabled.</p>\n<h2>Configuration</h2>\n<p>Options:</p>\n<table>\n<thead>\n<tr><th>Setting</th><th>Required</th></tr>\n</thead>\n<tbody>\n<tr><td>Access token</td><td>true</td></tr>\n<tr><td>Default Organization</td><td>false</td></tr>\n<tr><td>Default Repository</td><td>true</td></tr>\n<tr><td>GitHub Enterprise URL</td><td>false</td></tr>\n</tbody>\n</table>\n<p>To create a new Access Token, navigate to <a href=\"https://github.com/settings/tokens\" target=\"_blank\">Personal Access Tokens</a> and press <strong>Generate new token.</strong></p>\n<h3>Provisioning</h3>\n<p><a href=\"https://grafana.com/docs/grafana/latest/administration/provisioning/#data-sources\" target=\"_blank\">It’s possible to configure data sources using config files with Grafana’s provisioning system</a>.</p>\n<h4>With the <a href=\"https://github.com/prometheus-operator/prometheus-operator\" target=\"_blank\">prom-operator</a></h4>\n<pre><code class=\"language-yaml\">promop:\n  grafana:\n    additionalDataSources:\n      - name: GitHub Repo Insights\n        type: grafana-github-datasource\n        jsonData:\n          owner: ''\n          repository: ''\n        secureJsonData:\n          accessToken: '&lt;github api token&gt;'\n</code></pre>\n<h2>Annotations</h2>\n<p>Annotations overlay events on a graph.</p>\n<p><img src=\"https://github.com/grafana/github-datasource/raw/main/docs/screenshots/annotations.png\" alt=\"Annotations on a graph\"></p>\n<p>With annotations, you can display:</p>\n<ul>\n<li>Commits</li>\n<li>Issues</li>\n<li>Pull Requests</li>\n<li>Releases</li>\n<li>Tags</li>\n</ul>\n<p>on a graph.</p>\n<p>All annotations require that you select a field to display on the annotation, and a field that represents the time that the event occurred.</p>\n<p><img src=\"https://github.com/grafana/github-datasource/raw/main/docs/screenshots/annotations-editor.png\" alt=\"Annotations editor\"></p>\n<h2>Variables</h2>\n<p><a href=\"https://grafana.com/docs/grafana/latest/variables/\" target=\"_blank\">Variables</a> allow you to substitute values in a panel with pre-defined values.</p>\n<p><img src=\"https://github.com/grafana/github-datasource/raw/main/docs/screenshots/variables-create.png\" alt=\"Creating Variables\"></p>\n<p>You can reference them inside queries, allowing users to configure parameters such as <code>Query</code> or <code>Repository</code>.</p>\n<p><img src=\"https://github.com/grafana/github-datasource/raw/main/docs/screenshots/using-variables.png\" alt=\"Using Variables inside queries\"></p>\n<h2>Macros</h2>\n<p>You can use the following macros in your queries</p>\n<table>\n<thead>\n<tr><th>Macro Name</th><th>Syntax</th><th>Description</th><th>Example</th></tr>\n</thead>\n<tbody>\n<tr><td>multiVar</td><td><code>$__multiVar(prefix,$var)</code></td><td>Expands a multi value variable into github query string</td><td><code>$__multiVar(label,$labels)</code> will expand into <code>label:first-label label:second-label</code></td></tr>\n<tr><td></td><td></td><td>When using <strong>all</strong> in multi variable, use <strong>*</strong> as custom all value</td><td></td></tr>\n<tr><td>day</td><td><code>$__toDay(diff)</code></td><td>Returns the day according to UTC time, a difference in days can be added</td><td><code>created:$__toDay(-7)</code> on 2022-01-17 will expand into <code>created:2022-01-10</code></td></tr>\n</tbody>\n</table>\n<h2>Access Token Permissions</h2>\n<p>For all repositories:</p>\n<ul>\n<li><code>public_repo</code></li>\n<li><code>repo:status</code></li>\n<li><code>repo_deployment</code></li>\n<li><code>read:packages</code></li>\n<li><code>read:user</code></li>\n<li><code>user:email</code></li>\n</ul>\n<p>For Github projects:</p>\n<ul>\n<li><code>read:org</code></li>\n<li><code>read:project</code></li>\n</ul>\n<p>An extra setting is required for private repositories</p>\n<ul>\n<li><code>repo (Full control of private repositories)</code></li>\n</ul>\n<h2>Sample Dashboard</h2>\n<p>For documentation on importing dashboards, check out the documentation on <a href=\"https://grafana.com/docs/grafana/latest/reference/export_import/#importing-a-dashboard\" target=\"_blank\">grafana.com</a></p>\n<p>The sample dashboard can be obtained from either of two places.</p>\n<ol>\n<li><p>From the Grafana dashboards page <a href=\"https://grafana.com/grafana/dashboards/14000\" target=\"_blank\">located here</a></p></li>\n<li><p>From this repository</p></li>\n</ol>\n<p>If loading it from this repository, open Grafana and click &quot;Import Dashboard&quot;.</p>\n<p>Copy the JSON in <code>./src/dashboards/dashboard.json</code>, and paste it into the &quot;Import via panel json&quot; box.</p>\n<h2>Frequently Asked Questions</h2>\n<ul>\n<li><strong>I am using GitHub OAuth on Grafana. Can my users make requests with their individual GitHub accounts instead of a shared <code>access_token</code>?</strong></li>\n</ul>\n<p>No. This requires changes in Grafana first. See <a href=\"https://github.com/grafana/grafana/issues/26023\" target=\"_blank\">this issue</a> in the Grafana project.</p>\n<ul>\n<li><strong>Why does it sometimes take up to 5 minutes for my new pull request / new issue / new commit to show up?</strong></li>\n</ul>\n<p>We have aggressive caching enabled due to GitHub's rate limiting policies. When selecting a time range like &quot;Last hour&quot;, a combination of the queries for each panel and the time range is cached temporarily.</p>\n<ul>\n<li><strong>Why are there two selection options for Pull Requests and Issue times when creating annotations?</strong></li>\n</ul>\n<p>There are two times that affect an annotation:</p>\n<ul>\n<li>The time range of the dashboard or panel</li>\n<li>The time that should be used to display the event on the graph</li>\n</ul>\n<p>The first selection is used to filter the events that display on the graph. For example, if you select &quot;closed at&quot;, only events that were &quot;closed&quot; in your dashboard's time range will be displayed on the graph.</p>\n<p>The second selection is used to determine where on the graph the event should be displayed.</p>\n<p>Typically these will be the same, however there are some cases where you may want them to be different.</p>\n",
					"changelog": "<h1>Change Log</h1>\n<h2>[1.4.3] - 2023-03-07</h2>\n<ul>\n<li><strong>Chore</strong> - Update grafana-plugin-sdk-go to v0.155.0 to fix <code>The content of this plugin does not match its signature</code> error</li>\n</ul>\n<h2>[1.4.2] - 2023-03-06</h2>\n<ul>\n<li><strong>Chore</strong> - Migrate to create plugin and upgrade dependencies</li>\n</ul>\n<h2>[1.4.1] - 2023-03-01</h2>\n<ul>\n<li><strong>Feature</strong> - Added <code>RepositoryVulnerabilityAlertState</code> field to <code>Vulnerabilities</code> query</li>\n</ul>\n<h2>[1.4.0] - 2023-02-03</h2>\n<ul>\n<li><strong>Feature</strong> - Added stargazers query type</li>\n<li><strong>Chore</strong> - Minor documentation updates</li>\n</ul>\n<h2>[1.3.3] - 2023-01-09</h2>\n<ul>\n<li><strong>Chore</strong> - Removed angular dependency: migrated annotation editor</li>\n</ul>\n<h2>[1.3.2] - next</h2>\n<ul>\n<li><strong>Feature</strong> Added <code>$__toDay()</code> macro support</li>\n</ul>\n<h2>[1.3.1] 2022-12-21</h2>\n<ul>\n<li><strong>Chore</strong> - Updated go version to latest (1.19.4)</li>\n<li><strong>Chore</strong> - Updated backend grafana dependencies</li>\n<li><strong>Chore</strong> - Added spellcheck</li>\n</ul>\n<h2>[1.3.0] 2022-11-3</h2>\n<ul>\n<li><strong>Feature</strong> - Github projects - query items, user projects</li>\n<li><strong>Chore</strong> - Updated build to use go 1.19.3</li>\n</ul>\n<h2>[1.2.0] 2022-10-20</h2>\n<ul>\n<li><strong>Feature</strong> - Github projects</li>\n</ul>\n<h2>[1.1.0] - next</h2>\n<ul>\n<li>Updated grafana minimum runtime required to 8.4.7</li>\n</ul>\n<h2>[1.0.15] 2022-05-05</h2>\n<ul>\n<li>Fix variable interpolation</li>\n</ul>\n<h2>[1.0.14] 2022-04-25</h2>\n<ul>\n<li>Added a <code>$__multiVar()</code> macro support</li>\n</ul>\n<h2>[1.0.13] 2021-12-01</h2>\n<ul>\n<li>Fixed a bug where dashboard variables could not be set properly</li>\n</ul>\n<h2>[1.0.12] 2021-12-01</h2>\n<ul>\n<li>Added refId in annotation queries</li>\n</ul>\n<h2>[1.0.11] 2021-05-17</h2>\n<ul>\n<li>Added repository fields to the responses</li>\n</ul>\n<h2>[1.0.10] 2021-04-01</h2>\n<ul>\n<li>Fixed issue where some time values were being rendered incorrectly</li>\n</ul>\n<h2>[1.0.9] 2021-04-01</h2>\n<ul>\n<li>Fixed issue where dashboard path was not incorrect</li>\n</ul>\n<h2>[1.0.8] 2020-12-10</h2>\n<ul>\n<li>Fixed issue where screenshots were not rendering on grafana.com (thanks <a href=\"https://github.com/mjseaman\" target=\"_blank\">@mjseaman</a>)</li>\n</ul>\n<h2>[1.0.7] 2020-12-07</h2>\n<ul>\n<li>Added Tags to the list of queryable resources in the AnnotationsQueryEditor (\nthanks <a href=\"https://github.com/nazzzzz\" target=\"_blank\">@nazzzzz</a>)</li>\n</ul>\n<h2>[1.0.6] 2020-09-24</h2>\n<ul>\n<li>Added a message to the healthcheck success status (thanks <a href=\"https://github.com/vladimirdotk\" target=\"_blank\">@vladimirdotk</a>)</li>\n<li>Added URL option for GitHub Enterprise Users (thanks <a href=\"https://github.com/bmike78\" target=\"_blank\">@bmike78</a>)</li>\n</ul>\n<h2>[1.0.5] 2020-09-15</h2>\n<ul>\n<li>Added Pull Request ID (Number), URL, and Repository name to pull request responses ( fixes #60 )</li>\n<li>Added the ability to search for all Pull Requests in an organization using the org: search term ( fixes #61 )</li>\n<li>Removed limit from repository list ( fixes #59 )</li>\n</ul>\n<h2>[1.0.3] 2020-09-11</h2>\n<ul>\n<li>Add the ability to disable time field filtering for pull requests ( fixes #57 )</li>\n</ul>\n<h2>[1.0.1] 2020-09-11</h2>\n<ul>\n<li>Add the ability to query repositories for variables ( fixes #52 )</li>\n<li>Fix scoped variables for repeating panels ( fixes #51 )</li>\n<li>The default time field for pull requests (Closed At) is now being displayed instead of an empty dropdown</li>\n</ul>\n<h2>[1.0.0] 2020-09-10</h2>\n<ul>\n<li>Initial release</li>\n</ul>\n",
					"downloads": 4048003,
					"verified": false,
					"featured": 0,
					"internal": false,
					"downloadSlug": "grafana-github-datasource",
					"popularity": 0.0181,
					"signatureType": "grafana",
					"grafanaDependency": ">=8.4.7",
					"packages": {
						"linux-amd64": {
							"md5": "740c4eec91c1cb49bd69dba79c7e6cbd",
							"sha256": "08fa6bf89385515b0dab3b0e04dbd68e68486d47891f32a214ac6b55e1ac1097",
							"packageName": "linux-amd64",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=linux&arch=amd64"
						},
						"linux-arm64": {
							"md5": "b79eb684922a201e68bb2da8b669fa2c",
							"sha256": "43dccb5852a9ae8418f299e40e5b137e656b0c3ba05376d8d0b023eea6a74f4b",
							"packageName": "linux-arm64",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=linux&arch=arm64"
						},
						"linux-arm": {
							"md5": "7c1a1a50d6de2c79a206cb9dc0fc4c8c",
							"sha256": "c4ce6f36d769482d5c5e777efa4f33752ceee51f9ae3b4fe8c249ee94bfaca87",
							"packageName": "linux-arm",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=linux&arch=arm"
						},
						"windows-amd64": {
							"md5": "5e828b72b7987010889de322dd09e1e7",
							"sha256": "2f2bd8ef4a55d5506a3bccaa37f5e1ab3b5bca3216244a4be3b09bed5f123c79",
							"packageName": "windows-amd64",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=windows&arch=amd64"
						},
						"darwin-amd64": {
							"md5": "99fee436482c3eb0dcbbd80d880899e6",
							"sha256": "912c2f7451a8cc992ae74d153a78e9329db623900877ae98a9df9c1cb605e500",
							"packageName": "darwin-amd64",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=darwin&arch=amd64"
						},
						"darwin-arm64": {
							"md5": "68d14f2872bdbb1fd6dbbd2291147d4a",
							"sha256": "e47ebda930907c54be50cf8bbba7e5c99a99b2e3532b5649b0e8f3795debb0de",
							"packageName": "darwin-arm64",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=darwin&arch=arm64"
						}
					},
					"links": [{
							"rel": "self",
							"href": "/plugins/grafana-github-datasource"
						},
						{
							"rel": "versions",
							"href": "/plugins/grafana-github-datasource/versions"
						},
						{
							"rel": "latest",
							"href": "/plugins/grafana-github-datasource/versions/1.4.3"
						},
						{
							"rel": "download",
							"href": "/plugins/grafana-github-datasource/versions/1.4.3/download"
						}
					]
				}
			`),
		))
	})

	// mock plugin version data
	mux.HandleFunc(fmt.Sprintf("/%s/version/%s", data.pluginID, data.version), func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")

		_, _ = w.Write([]byte(fmt.Sprintf(`
				{
					"id": 4531,
					"pluginId": 663,
					"pluginSlug": "grafana-github-datasource",
					"version": "1.4.3",
					"url": "https://github.com/grafana/github-datasource/",
					"commit": "",
					"description": "Show data about github issues/pull requests",
					"createdAt": "2023-03-07T11:02:08.000Z",
					"updatedAt": null,
					"json": {
						"$schema": "https://raw.githubusercontent.com/grafana/grafana/main/docs/sources/developers/plugins/plugin.schema.json",
						"alerting": true,
						"annotations": true,
						"backend": true,
						"dependencies": {
							"grafanaDependency": ">=8.4.7",
							"grafanaVersion": "8.4.x",
							"plugins": []
						},
						"executable": "gfx_github",
						"id": "grafana-github-datasource",
						"includes": [{
							"name": "GitHub (demo)",
							"path": "dashboards/dashboard.json",
							"type": "dashboard"
						}],
						"info": {
							"author": {
								"name": "Grafana Labs",
								"url": "https://grafana.com"
							},
							"build": {
								"time": 1678186382802,
								"repo": "https://github.com/grafana/github-datasource",
								"branch": "main",
								"hash": "980f0ab224bdc83d9b0ac2d42d6e0adbbf66d734",
								"build": 231
							},
							"description": "Show data about github issues/pull requests",
							"keywords": [
								"github",
								"datasource"
							],
							"links": [{
								"name": "Website",
								"url": "https://github.com/grafana/github-datasource"
							}],
							"logos": {
								"large": "img/github.svg",
								"small": "img/github.svg"
							},
							"screenshots": [],
							"updated": "2023-03-07",
							"version": "1.4.3"
						},
						"metrics": true,
						"name": "GitHub",
						"type": "datasource"
					},
					"readme": "<h1>Grafana GitHub datasource</h1>\n<p>The GitHub datasource allows GitHub API data to be visually represented in Grafana dashboards.</p>\n<h2>GitHub API V4 (GraphQL)</h2>\n<p>This datasource uses the <a href=\"https://github.com/shurcooL/githubv4\" target=\"_blank\"><code>githubv4</code> package</a>, which is under active development.</p>\n<h2>Features</h2>\n<h3>Backend</h3>\n<ul>\n<li>[x] Releases</li>\n<li>[x] Commits</li>\n<li>[x] Repositories</li>\n<li>[x] Stargazers</li>\n<li>[x] Issues</li>\n<li>[x] Organizations</li>\n<li>[x] Labels</li>\n<li>[x] Milestones</li>\n<li>[x] Response Caching</li>\n<li>[x] Projects</li>\n<li>[ ] Deploys</li>\n</ul>\n<h3>Frontend</h3>\n<ul>\n<li>[x] Visualize queries</li>\n<li>[x] Template variables</li>\n<li>[x] Annotations</li>\n</ul>\n<h2>Caching</h2>\n<p>Caching on this plugin is always enabled.</p>\n<h2>Configuration</h2>\n<p>Options:</p>\n<table>\n<thead>\n<tr><th>Setting</th><th>Required</th></tr>\n</thead>\n<tbody>\n<tr><td>Access token</td><td>true</td></tr>\n<tr><td>Default Organization</td><td>false</td></tr>\n<tr><td>Default Repository</td><td>true</td></tr>\n<tr><td>GitHub Enterprise URL</td><td>false</td></tr>\n</tbody>\n</table>\n<p>To create a new Access Token, navigate to <a href=\"https://github.com/settings/tokens\" target=\"_blank\">Personal Access Tokens</a> and press <strong>Generate new token.</strong></p>\n<h3>Provisioning</h3>\n<p><a href=\"https://grafana.com/docs/grafana/latest/administration/provisioning/#data-sources\" target=\"_blank\">It’s possible to configure data sources using config files with Grafana’s provisioning system</a>.</p>\n<h4>With the <a href=\"https://github.com/prometheus-operator/prometheus-operator\" target=\"_blank\">prom-operator</a></h4>\n<pre><code class=\"language-yaml\">promop:\n  grafana:\n    additionalDataSources:\n      - name: GitHub Repo Insights\n        type: grafana-github-datasource\n        jsonData:\n          owner: ''\n          repository: ''\n        secureJsonData:\n          accessToken: '&lt;github api token&gt;'\n</code></pre>\n<h2>Annotations</h2>\n<p>Annotations overlay events on a graph.</p>\n<p><img src=\"https://github.com/grafana/github-datasource/raw/main/docs/screenshots/annotations.png\" alt=\"Annotations on a graph\"></p>\n<p>With annotations, you can display:</p>\n<ul>\n<li>Commits</li>\n<li>Issues</li>\n<li>Pull Requests</li>\n<li>Releases</li>\n<li>Tags</li>\n</ul>\n<p>on a graph.</p>\n<p>All annotations require that you select a field to display on the annotation, and a field that represents the time that the event occurred.</p>\n<p><img src=\"https://github.com/grafana/github-datasource/raw/main/docs/screenshots/annotations-editor.png\" alt=\"Annotations editor\"></p>\n<h2>Variables</h2>\n<p><a href=\"https://grafana.com/docs/grafana/latest/variables/\" target=\"_blank\">Variables</a> allow you to substitute values in a panel with pre-defined values.</p>\n<p><img src=\"https://github.com/grafana/github-datasource/raw/main/docs/screenshots/variables-create.png\" alt=\"Creating Variables\"></p>\n<p>You can reference them inside queries, allowing users to configure parameters such as <code>Query</code> or <code>Repository</code>.</p>\n<p><img src=\"https://github.com/grafana/github-datasource/raw/main/docs/screenshots/using-variables.png\" alt=\"Using Variables inside queries\"></p>\n<h2>Macros</h2>\n<p>You can use the following macros in your queries</p>\n<table>\n<thead>\n<tr><th>Macro Name</th><th>Syntax</th><th>Description</th><th>Example</th></tr>\n</thead>\n<tbody>\n<tr><td>multiVar</td><td><code>$__multiVar(prefix,$var)</code></td><td>Expands a multi value variable into github query string</td><td><code>$__multiVar(label,$labels)</code> will expand into <code>label:first-label label:second-label</code></td></tr>\n<tr><td></td><td></td><td>When using <strong>all</strong> in multi variable, use <strong>*</strong> as custom all value</td><td></td></tr>\n<tr><td>day</td><td><code>$__toDay(diff)</code></td><td>Returns the day according to UTC time, a difference in days can be added</td><td><code>created:$__toDay(-7)</code> on 2022-01-17 will expand into <code>created:2022-01-10</code></td></tr>\n</tbody>\n</table>\n<h2>Access Token Permissions</h2>\n<p>For all repositories:</p>\n<ul>\n<li><code>public_repo</code></li>\n<li><code>repo:status</code></li>\n<li><code>repo_deployment</code></li>\n<li><code>read:packages</code></li>\n<li><code>read:user</code></li>\n<li><code>user:email</code></li>\n</ul>\n<p>For Github projects:</p>\n<ul>\n<li><code>read:org</code></li>\n<li><code>read:project</code></li>\n</ul>\n<p>An extra setting is required for private repositories</p>\n<ul>\n<li><code>repo (Full control of private repositories)</code></li>\n</ul>\n<h2>Sample Dashboard</h2>\n<p>For documentation on importing dashboards, check out the documentation on <a href=\"https://grafana.com/docs/grafana/latest/reference/export_import/#importing-a-dashboard\" target=\"_blank\">grafana.com</a></p>\n<p>The sample dashboard can be obtained from either of two places.</p>\n<ol>\n<li><p>From the Grafana dashboards page <a href=\"https://grafana.com/grafana/dashboards/14000\" target=\"_blank\">located here</a></p></li>\n<li><p>From this repository</p></li>\n</ol>\n<p>If loading it from this repository, open Grafana and click &quot;Import Dashboard&quot;.</p>\n<p>Copy the JSON in <code>./src/dashboards/dashboard.json</code>, and paste it into the &quot;Import via panel json&quot; box.</p>\n<h2>Frequently Asked Questions</h2>\n<ul>\n<li><strong>I am using GitHub OAuth on Grafana. Can my users make requests with their individual GitHub accounts instead of a shared <code>access_token</code>?</strong></li>\n</ul>\n<p>No. This requires changes in Grafana first. See <a href=\"https://github.com/grafana/grafana/issues/26023\" target=\"_blank\">this issue</a> in the Grafana project.</p>\n<ul>\n<li><strong>Why does it sometimes take up to 5 minutes for my new pull request / new issue / new commit to show up?</strong></li>\n</ul>\n<p>We have aggressive caching enabled due to GitHub's rate limiting policies. When selecting a time range like &quot;Last hour&quot;, a combination of the queries for each panel and the time range is cached temporarily.</p>\n<ul>\n<li><strong>Why are there two selection options for Pull Requests and Issue times when creating annotations?</strong></li>\n</ul>\n<p>There are two times that affect an annotation:</p>\n<ul>\n<li>The time range of the dashboard or panel</li>\n<li>The time that should be used to display the event on the graph</li>\n</ul>\n<p>The first selection is used to filter the events that display on the graph. For example, if you select &quot;closed at&quot;, only events that were &quot;closed&quot; in your dashboard's time range will be displayed on the graph.</p>\n<p>The second selection is used to determine where on the graph the event should be displayed.</p>\n<p>Typically these will be the same, however there are some cases where you may want them to be different.</p>\n",
					"downloads": 207452,
					"verified": false,
					"status": "active",
					"downloadSlug": "grafana-github-datasource",
					"signatureType": "grafana",
					"signedByOrg": "grafana",
					"signedByOrgName": "Grafana Labs",
					"packages": {
						"linux-amd64": {
							"md5": "740c4eec91c1cb49bd69dba79c7e6cbd",
							"sha256": "08fa6bf89385515b0dab3b0e04dbd68e68486d47891f32a214ac6b55e1ac1097",
							"packageName": "linux-amd64",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=linux&arch=amd64"
						},
						"linux-arm64": {
							"md5": "b79eb684922a201e68bb2da8b669fa2c",
							"sha256": "43dccb5852a9ae8418f299e40e5b137e656b0c3ba05376d8d0b023eea6a74f4b",
							"packageName": "linux-arm64",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=linux&arch=arm64"
						},
						"linux-arm": {
							"md5": "7c1a1a50d6de2c79a206cb9dc0fc4c8c",
							"sha256": "c4ce6f36d769482d5c5e777efa4f33752ceee51f9ae3b4fe8c249ee94bfaca87",
							"packageName": "linux-arm",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=linux&arch=arm"
						},
						"windows-amd64": {
							"md5": "5e828b72b7987010889de322dd09e1e7",
							"sha256": "2f2bd8ef4a55d5506a3bccaa37f5e1ab3b5bca3216244a4be3b09bed5f123c79",
							"packageName": "windows-amd64",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=windows&arch=amd64"
						},
						"darwin-amd64": {
							"md5": "99fee436482c3eb0dcbbd80d880899e6",
							"sha256": "912c2f7451a8cc992ae74d153a78e9329db623900877ae98a9df9c1cb605e500",
							"packageName": "darwin-amd64",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=darwin&arch=amd64"
						},
						"darwin-arm64": {
							"md5": "68d14f2872bdbb1fd6dbbd2291147d4a",
							"sha256": "e47ebda930907c54be50cf8bbba7e5c99a99b2e3532b5649b0e8f3795debb0de",
							"packageName": "darwin-arm64",
							"downloadUrl": "/api/plugins/grafana-github-datasource/versions/1.4.3/download?os=darwin&arch=arm64"
						}
					},
					"links": [{
							"rel": "self",
							"href": "/plugins/grafana-github-datasource/versions/1.4.3"
						},
						{
							"rel": "images",
							"href": "/plugins/grafana-github-datasource/versions/1.4.3/images"
						},
						{
							"rel": "thumbnails",
							"href": "/plugins/grafana-github-datasource/versions/1.4.3/thumbnails"
						},
						{
							"rel": "plugin",
							"href": "/plugins/grafana-github-datasource"
						},
						{
							"rel": "download",
							"href": "/plugins/grafana-github-datasource/versions/1.4.3/download"
						}
					],
					"grafanaDependency": ">=8.4.7"
				}
			`),
		))
	})

	// mock plugin archive
	mux.HandleFunc(fmt.Sprintf("/%s/version/%s/download", data.pluginID, data.version), func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(data.archive)
	})

	return httptest.NewServer(mux)
}

type versionArg struct {
	version string
	arch    []string
}

func createPluginVersions(versions ...versionArg) []Version {
	var vs []Version

	for _, version := range versions {
		ver := Version{
			Version: version.version,
		}
		if version.arch != nil {
			ver.Arch = map[string]ArchMeta{}
			for _, arch := range version.arch {
				ver.Arch[arch] = ArchMeta{
					SHA256: fmt.Sprintf("sha256_%s", arch),
				}
			}
		}
		vs = append(vs, ver)
	}

	return vs
}

type fakeLogger struct{}

func (f *fakeLogger) Successf(_ string, _ ...interface{}) {}
func (f *fakeLogger) Failuref(_ string, _ ...interface{}) {}
func (f *fakeLogger) Info(_ ...interface{})               {}
func (f *fakeLogger) Infof(_ string, _ ...interface{})    {}
func (f *fakeLogger) Debug(_ ...interface{})              {}
func (f *fakeLogger) Debugf(_ string, _ ...interface{})   {}
func (f *fakeLogger) Warn(_ ...interface{})               {}
func (f *fakeLogger) Warnf(_ string, _ ...interface{})    {}
func (f *fakeLogger) Error(_ ...interface{})              {}
func (f *fakeLogger) Errorf(_ string, _ ...interface{})   {}
