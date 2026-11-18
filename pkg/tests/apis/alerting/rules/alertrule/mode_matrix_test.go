package alertrule

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var allDualWriterModes = []grafanarest.DualWriterMode{
	grafanarest.Mode0, grafanarest.Mode1, grafanarest.Mode2,
	grafanarest.Mode3, grafanarest.Mode4, grafanarest.Mode5,
}

// One server per dual writer mode, shared by every mode-parametrized group, because
// starting the server is most of the cost of each mode.
func TestIntegrationDualWriterModes(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, mode := range allDualWriterModes {
		t.Run(fmt.Sprintf("dualWriterMode=%d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"alertrules.rules.alerting.grafana.app":     {DualWriterMode: mode},
					"recordingrules.rules.alerting.grafana.app": {DualWriterMode: mode},
				},
				UnifiedAlertingDisableExecuteAlerts: true,
			})
			common.CreateTestFolder(t, helper, "test-folder")
			t.Run("v1beta1", func(t *testing.T) { runV1beta1Tests(t, helper, mode) })
			t.Run("matrix", func(t *testing.T) { runModeMatrixTests(t, helper, mode) })
		})
	}
}

// A matrix case runs in every mode and returns a short outcome string. want is the
// outcome in every mode; except lists the modes that legitimately differ today, each
// with a comment saying why. A mode regression or a fixed difference is then a
// one-line change to except.
type matrixCase struct {
	name   string
	run    func(t *testing.T, k *matrixKind) string
	want   string
	except modeOutcomes
}

// Short names keep each except entry on one line. Today mode 0 is legacy only, modes
// 1-3 are the same dual writer (writes legacy then unified, reads legacy), and modes
// 4-5 are unified only, so most differences split 0-3 against 4-5.
const (
	m0 = grafanarest.Mode0
	m1 = grafanarest.Mode1
	m2 = grafanarest.Mode2
	m3 = grafanarest.Mode3
	m4 = grafanarest.Mode4
	m5 = grafanarest.Mode5
)

type modeOutcomes = map[grafanarest.DualWriterMode]string

func (c matrixCase) expected(mode grafanarest.DualWriterMode) string {
	if v, ok := c.except[mode]; ok {
		return v
	}
	return c.want
}

const (
	matrixFolderA  = "matrix-a"
	matrixFolderB  = "matrix-b"
	matrixLabelKey = "matrix-team"
)

// matrixKind is one rule kind under test, with five fixtures:
//
//	alias  folder  paused  metadata label  metric (recording rules)
//	a1     a       no      matrix-team=x   matrix_metric_a
//	a2     a       yes                     matrix_metric_b
//	a3     a       no      matrix-team=x   matrix_metric_a
//	b1     b       yes     matrix-team=x   matrix_metric_b
//	b2     b       no                      matrix_metric_b
type matrixKind struct {
	ctx      context.Context
	client   versionClient
	resource string
	body     func(t *testing.T) map[string]any
	// kindField is a field selector only this kind supports; within folder b it matches b1 and b2.
	kindField string

	aliases map[string]string // name -> alias
	names   map[string]string // alias -> name
}

type matrixFixture struct {
	alias, folder string
	paused        bool
	labelled      bool
	metric        string
}

var matrixFixtures = []matrixFixture{
	{alias: "a1", folder: matrixFolderA, labelled: true, metric: "matrix_metric_a"},
	{alias: "a2", folder: matrixFolderA, paused: true, metric: "matrix_metric_b"},
	{alias: "a3", folder: matrixFolderA, labelled: true, metric: "matrix_metric_a"},
	{alias: "b1", folder: matrixFolderB, paused: true, labelled: true, metric: "matrix_metric_b"},
	{alias: "b2", folder: matrixFolderB, metric: "matrix_metric_b"},
}

func (k *matrixKind) title(alias string) string {
	return k.resource + " matrix " + alias
}

// alias reverses title, so outcomes read the same for both kinds.
func (k *matrixKind) alias(title any) string {
	return strings.TrimPrefix(fmt.Sprint(title), k.title(""))
}

// newRule builds a valid rule body in folder, with a title derived from alias.
func (k *matrixKind) newRule(t *testing.T, alias, folder string) map[string]any {
	t.Helper()
	obj := k.body(t)
	meta := obj["metadata"].(map[string]any)
	meta["annotations"] = map[string]any{v1beta1.FolderAnnotationKey: folder}
	obj["spec"].(map[string]any)["title"] = k.title(alias)
	return obj
}

func (k *matrixKind) createFixtures(t *testing.T) {
	t.Helper()
	k.aliases, k.names = map[string]string{}, map[string]string{}
	for _, f := range matrixFixtures {
		obj := k.newRule(t, f.alias, f.folder)
		spec := obj["spec"].(map[string]any)
		spec["paused"] = f.paused
		if k.resource == "recordingrules" {
			spec["metric"] = f.metric
		}
		if f.labelled {
			obj["metadata"].(map[string]any)["labels"] = map[string]any{matrixLabelKey: "x"}
		}
		created, err := k.client.create(k.ctx, k.resource, obj)
		require.NoError(t, err, f.alias)
		name := field(t, created, "metadata", "name").(string)
		k.aliases[name], k.names[f.alias] = f.alias, name
		t.Cleanup(func() { _ = k.client.delete(k.ctx, k.resource, name) })
	}
}

// list returns the fixture aliases in one page, sorted, ignoring rules other
// tests created, and the page's continue token.
func (k *matrixKind) list(opts metav1.ListOptions) ([]string, string, error) {
	req := k.client.rc.Get().AbsPath(k.client.path(k.resource)...)
	if opts.LabelSelector != "" {
		req = req.Param("labelSelector", opts.LabelSelector)
	}
	if opts.FieldSelector != "" {
		req = req.Param("fieldSelector", opts.FieldSelector)
	}
	if opts.Limit > 0 {
		req = req.Param("limit", strconv.FormatInt(opts.Limit, 10))
	}
	if opts.Continue != "" {
		req = req.Param("continue", opts.Continue)
	}
	raw, err := req.DoRaw(k.ctx)
	out, err := decode(raw, err)
	if err != nil {
		return nil, "", err
	}
	var aliases []string
	items, _ := out["items"].([]any)
	for _, item := range items {
		name, _ := item.(map[string]any)["metadata"].(map[string]any)["name"].(string)
		if alias, ok := k.aliases[name]; ok {
			aliases = append(aliases, alias)
		}
	}
	slices.Sort(aliases)
	cont, _ := out["metadata"].(map[string]any)["continue"].(string)
	return aliases, cont, nil
}

// listOutcome is the comma-separated fixture aliases a list matched, or the error reason.
func (k *matrixKind) listOutcome(opts metav1.ListOptions) string {
	aliases, _, err := k.list(opts)
	if err != nil {
		return reason(err)
	}
	return strings.Join(aliases, ",")
}

// pages walks every page and returns the fixture count on each page and the fixture
// aliases seen across them, sorted.
func (k *matrixKind) pages(t *testing.T, opts metav1.ListOptions) ([]int, []string, error) {
	t.Helper()
	var all []string
	var sizes []int
	for {
		page, cont, err := k.list(opts)
		if err != nil {
			return nil, nil, err
		}
		sizes = append(sizes, len(page))
		all = append(all, page...)
		if cont == "" {
			break
		}
		require.Less(t, len(sizes), 50, "pagination does not terminate")
		opts.Continue = cont
	}
	slices.Sort(all)
	return sizes, all, nil
}

// paginate reports the fixture count on each page and the fixtures seen across them.
// One trailing empty page is dropped: whether it appears is a separate case,
// "list/paginate ends with an empty page".
func (k *matrixKind) paginate(t *testing.T, opts metav1.ListOptions) string {
	t.Helper()
	sizes, all, err := k.pages(t, opts)
	if err != nil {
		return reason(err)
	}
	if len(sizes) > 1 && sizes[len(sizes)-1] == 0 {
		sizes = sizes[:len(sizes)-1]
	}
	if len(slices.Compact(slices.Clone(all))) != len(all) {
		return "duplicates: " + strings.Join(all, ",")
	}
	return fmt.Sprintf("pages=%v %s", sizes, strings.Join(all, ","))
}

// reason maps an API error to its status reason, so outcomes stay short and stable.
func reason(err error) string {
	if err == nil {
		return "ok"
	}
	if r := apierrors.ReasonForError(err); r != metav1.StatusReasonUnknown {
		return string(r)
	}
	return err.Error()
}

func folderLabelSelector(op, folder string) metav1.ListOptions {
	return metav1.ListOptions{LabelSelector: v1beta1.FolderLabelKey + op + folder}
}

func createMatrixFolder(t *testing.T, helper *apis.K8sTestHelper, uid string) {
	t.Helper()
	_, err := common.NewFolderClient(t, helper.Org1.Admin).Create(context.Background(), &folders.Folder{
		ObjectMeta: metav1.ObjectMeta{Name: uid, Namespace: "default"},
		Spec:       folders.FolderSpec{Title: uid},
	}, metav1.CreateOptions{})
	require.NoError(t, err)
}

// unthrottledClient is helper's REST client without client-side rate limiting. The
// shared config allows 10 requests a second after a burst of 20, which made the
// matrix spend most of its time waiting on the client.
func unthrottledClient(t *testing.T, user apis.User, gv schema.GroupVersion) versionClient {
	t.Helper()
	cfg := dynamic.ConfigFor(user.NewRestConfig())
	cfg.QPS = -1
	cfg.GroupVersion = &gv
	cfg.APIPath = "apis"
	rc, err := rest.RESTClientFor(cfg)
	require.NoError(t, err)
	return versionClient{rc: rc, gv: gv}
}

func runModeMatrixTests(t *testing.T, helper *apis.K8sTestHelper, mode grafanarest.DualWriterMode) {
	ctx := context.Background()
	beta := unthrottledClient(t, helper.Org1.Admin, v1beta1.GroupVersion)
	createMatrixFolder(t, helper, matrixFolderA)
	createMatrixFolder(t, helper, matrixFolderB)

	kinds := []*matrixKind{
		{ctx: ctx, client: beta, resource: "alertrules", body: alertRuleBody,
			kindField: "spec.notificationSettings.receiver=empty"},
		{ctx: ctx, client: beta, resource: "recordingrules", body: recordingRuleBody,
			kindField: "spec.metric=matrix_metric_b"},
	}

	// Lists run against the fixtures, which no case changes.
	listCases := []matrixCase{
		{
			name: "list/no selector",
			run:  func(t *testing.T, k *matrixKind) string { return k.listOutcome(metav1.ListOptions{}) },
			want: "a1,a2,a3,b1,b2",
		},
		{
			name: "list/label folder=a",
			run: func(t *testing.T, k *matrixKind) string {
				return k.listOutcome(folderLabelSelector("=", matrixFolderA))
			},
			want: "a1,a2,a3",
		},
		{
			name: "list/label folder!=a",
			run: func(t *testing.T, k *matrixKind) string {
				return k.listOutcome(folderLabelSelector("!=", matrixFolderA))
			},
			want: "b1,b2",
		},
		{
			name: "list/label folder in (a,b)",
			run: func(t *testing.T, k *matrixKind) string {
				return k.listOutcome(folderLabelSelector(" in ", "("+matrixFolderA+","+matrixFolderB+")"))
			},
			want: "a1,a2,a3,b1,b2",
		},
		{
			name: "list/label custom metadata label",
			run: func(t *testing.T, k *matrixKind) string {
				return k.listOutcome(metav1.ListOptions{LabelSelector: matrixLabelKey + "=x"})
			},
			want: "a1,a3,b1",
			// Legacy storage keeps no metadata labels and filters on the folder and group
			// label keys only, so other label requirements are silently dropped.
			except: modeOutcomes{
				m0: "a1,a2,a3,b1,b2",
				m1: "a1,a2,a3,b1,b2",
				m2: "a1,a2,a3,b1,b2",
				m3: "a1,a2,a3,b1,b2",
			},
		},
		{
			name: "list/label custom and field spec.paused=true",
			run: func(t *testing.T, k *matrixKind) string {
				return k.listOutcome(metav1.ListOptions{LabelSelector: matrixLabelKey + "=x", FieldSelector: "spec.paused=true"})
			},
			want: "b1",
			// As above: legacy drops the custom label requirement and applies only the field.
			except: modeOutcomes{
				m0: "a2,b1",
				m1: "a2,b1",
				m2: "a2,b1",
				m3: "a2,b1",
			},
		},
		{
			name: "list/field spec.title=",
			run: func(t *testing.T, k *matrixKind) string {
				return k.listOutcome(metav1.ListOptions{FieldSelector: "spec.title=" + k.title("a2")})
			},
			want: "a2",
		},
		{
			name: "list/field spec.paused=true",
			run: func(t *testing.T, k *matrixKind) string {
				return k.listOutcome(metav1.ListOptions{FieldSelector: "spec.paused=true"})
			},
			want: "a2,b1",
		},
		{
			name: "list/label folder=a and field spec.title!=",
			run: func(t *testing.T, k *matrixKind) string {
				opts := folderLabelSelector("=", matrixFolderA)
				opts.FieldSelector = "spec.title!=" + k.title("a1")
				return k.listOutcome(opts)
			},
			want: "a2,a3",
		},
		{
			name: "list/label folder=a and field spec.paused=false",
			run: func(t *testing.T, k *matrixKind) string {
				opts := folderLabelSelector("=", matrixFolderA)
				opts.FieldSelector = "spec.paused=false"
				return k.listOutcome(opts)
			},
			want: "a1,a3",
		},
		{
			name: "list/label folder=b and field kind-specific",
			run: func(t *testing.T, k *matrixKind) string {
				opts := folderLabelSelector("=", matrixFolderB)
				opts.FieldSelector = k.kindField
				return k.listOutcome(opts)
			},
			want: "b1,b2",
		},
		{
			name: "list/field unknown",
			run: func(t *testing.T, k *matrixKind) string {
				return k.listOutcome(metav1.ListOptions{FieldSelector: "spec.nope=1"})
			},
			want: string(metav1.StatusReasonBadRequest),
		},
		{
			name: "list/paginate label folder=a limit=2",
			run: func(t *testing.T, k *matrixKind) string {
				opts := folderLabelSelector("=", matrixFolderA)
				opts.Limit = 2
				return k.paginate(t, opts)
			},
			want: "pages=[2 1] a1,a2,a3",
		},
		{
			name: "list/paginate limit=1",
			run: func(t *testing.T, k *matrixKind) string {
				return k.paginate(t, metav1.ListOptions{Limit: 1, LabelSelector: v1beta1.FolderLabelKey + " in (" + matrixFolderA + "," + matrixFolderB + ")"})
			},
			want: "pages=[1 1 1 1 1] a1,a2,a3,b1,b2",
		},
		{
			name: "list/paginate ends with an empty page",
			run: func(t *testing.T, k *matrixKind) string {
				opts := folderLabelSelector("=", matrixFolderA)
				opts.Limit = 2
				sizes, _, err := k.pages(t, opts)
				if err != nil {
					return reason(err)
				}
				return strconv.FormatBool(sizes[len(sizes)-1] == 0)
			},
			// Unified storage returns a continue token with the page holding the last
			// match, so clients see one more, empty, page.
			want: "true",
			except: modeOutcomes{
				// Legacy returns no continue token once it runs out of rules.
				m0: "false",
				// Modes 1-3 read legacy but merge in the unified continue token, then answer
				// the next request with an empty list once legacy is done. This depends on
				// the background unified list answering within the dual writer's 300ms wait.
				m1: "true",
				m2: "true",
				m3: "true",
			},
		},
	}

	// CRUD cases each work on their own rule in folder b.
	crudCases := []matrixCase{
		{
			name: "create/sets folder label",
			run: func(t *testing.T, k *matrixKind) string {
				created, err := k.client.create(ctx, k.resource, k.newRule(t, "create", matrixFolderB))
				if err != nil {
					return reason(err)
				}
				name := field(t, created, "metadata", "name").(string)
				t.Cleanup(func() { _ = k.client.delete(ctx, k.resource, name) })
				return fmt.Sprintf("folder=%v", field(t, created, "metadata", "labels", v1beta1.FolderLabelKey))
			},
			want: "folder=" + matrixFolderB,
		},
		{
			name: "create/keeps custom metadata label",
			run: func(t *testing.T, k *matrixKind) string {
				got, err := k.client.get(ctx, k.resource, k.names["a1"])
				if err != nil {
					return reason(err)
				}
				labels, _ := got["metadata"].(map[string]any)["labels"].(map[string]any)
				return fmt.Sprintf("%s=%v", matrixLabelKey, labels[matrixLabelKey])
			},
			want: matrixLabelKey + "=x",
			// Legacy storage persists only the folder and group labels; modes 1-3 read legacy.
			except: modeOutcomes{
				m0: matrixLabelKey + "=<nil>",
				m1: matrixLabelKey + "=<nil>",
				m2: matrixLabelKey + "=<nil>",
				m3: matrixLabelKey + "=<nil>",
			},
		},
		{
			name: "create/duplicate name",
			run: func(t *testing.T, k *matrixKind) string {
				dup := k.newRule(t, "dup", matrixFolderB)
				dup["metadata"].(map[string]any)["name"] = k.names["b1"]
				_, err := k.client.create(ctx, k.resource, dup)
				return reason(err)
			},
			want: string(metav1.StatusReasonAlreadyExists),
		},
		{
			name: "get/existing",
			run: func(t *testing.T, k *matrixKind) string {
				got, err := k.client.get(ctx, k.resource, k.names["a2"])
				if err != nil {
					return reason(err)
				}
				return fmt.Sprintf("%s paused=%v", k.alias(field(t, got, "spec", "title")), field(t, got, "spec", "paused"))
			},
			want: "a2 paused=true",
		},
		{
			name: "get/missing",
			run: func(t *testing.T, k *matrixKind) string {
				_, err := k.client.get(ctx, k.resource, "matrix-get-missing")
				return reason(err)
			},
			want: string(metav1.StatusReasonNotFound),
		},
		{
			name: "update/title",
			run: func(t *testing.T, k *matrixKind) string {
				created, err := k.client.create(ctx, k.resource, k.newRule(t, "update", matrixFolderB))
				require.NoError(t, err)
				name := field(t, created, "metadata", "name").(string)
				t.Cleanup(func() { _ = k.client.delete(ctx, k.resource, name) })

				created["spec"].(map[string]any)["title"] = k.title("updated")
				updated, err := k.client.update(ctx, k.resource, created)
				if err != nil {
					return reason(err)
				}
				got, err := k.client.get(ctx, k.resource, name)
				require.NoError(t, err)
				rvChanged := field(t, updated, "metadata", "resourceVersion") != field(t, created, "metadata", "resourceVersion")
				return fmt.Sprintf("%s rvChanged=%v", k.alias(field(t, got, "spec", "title")), rvChanged)
			},
			want: "updated rvChanged=true",
		},
		{
			name: "update/stale resourceVersion",
			run: func(t *testing.T, k *matrixKind) string {
				created, err := k.client.create(ctx, k.resource, k.newRule(t, "stale", matrixFolderB))
				require.NoError(t, err)
				name := field(t, created, "metadata", "name").(string)
				t.Cleanup(func() { _ = k.client.delete(ctx, k.resource, name) })

				fresh, err := k.client.get(ctx, k.resource, name)
				require.NoError(t, err)
				fresh["spec"].(map[string]any)["title"] = k.title("stale-first")
				_, err = k.client.update(ctx, k.resource, fresh)
				require.NoError(t, err)

				// created still carries the resourceVersion from before the first update.
				created["spec"].(map[string]any)["title"] = k.title("stale-second")
				_, err = k.client.update(ctx, k.resource, created)
				return reason(err)
			},
			want: string(metav1.StatusReasonConflict),
			// Legacy Update does not compare resourceVersion, so the last write wins. In
			// modes 1-3 the dual writer writes legacy first and returns its result.
			except: modeOutcomes{
				m0: "ok",
				m1: "ok",
				m2: "ok",
				m3: "ok",
			},
		},
		{
			name: "update/missing",
			run: func(t *testing.T, k *matrixKind) string {
				const name = "matrix-update-missing"
				missing := k.newRule(t, "missing", matrixFolderB)
				missing["metadata"].(map[string]any)["name"] = name
				_, err := k.client.update(ctx, k.resource, missing)
				t.Cleanup(func() { _ = k.client.delete(ctx, k.resource, name) })
				_, getErr := k.client.get(ctx, k.resource, name)
				return fmt.Sprintf("%s get=%s", reason(err), reason(getErr))
			},
			want: "NotFound get=NotFound",
			// Unified storage treats an update of a missing name as a create.
			except: modeOutcomes{
				m4: "ok get=ok",
				m5: "ok get=ok",
			},
		},
		{
			name: "delete/then get and list",
			run: func(t *testing.T, k *matrixKind) string {
				created, err := k.client.create(ctx, k.resource, k.newRule(t, "delete", matrixFolderB))
				require.NoError(t, err)
				name := field(t, created, "metadata", "name").(string)
				if err := k.client.delete(ctx, k.resource, name); err != nil {
					return reason(err)
				}
				_, getErr := k.client.get(ctx, k.resource, name)
				list, err := k.client.list(ctx, k.resource)
				require.NoError(t, err)
				listed := slices.ContainsFunc(list["items"].([]any), func(item any) bool {
					return item.(map[string]any)["metadata"].(map[string]any)["name"] == name
				})
				return fmt.Sprintf("get=%s listed=%v", reason(getErr), listed)
			},
			want: "get=NotFound listed=false",
		},
		{
			name: "delete/missing",
			run: func(t *testing.T, k *matrixKind) string {
				return reason(k.client.delete(ctx, k.resource, "matrix-delete-missing"))
			},
			want: string(metav1.StatusReasonNotFound),
		},
	}

	for _, k := range kinds {
		t.Run(k.resource, func(t *testing.T) {
			k.createFixtures(t)
			for _, c := range slices.Concat(listCases, crudCases) {
				t.Run(c.name, func(t *testing.T) {
					assert.Equal(t, c.expected(mode), c.run(t, k), "mode %d", mode)
				})
			}
		})
	}
}
