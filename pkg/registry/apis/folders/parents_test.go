package folders

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

func TestParents(t *testing.T) {
	type input struct {
		name   string
		folder string
	}
	tests := []struct {
		name    string
		request struct {
			name   string
			folder string
		}
		getter         map[string]*folders.Folder
		setupFn        func(*grafanarest.MockStorage) // called after the getter is registered
		expected       *folders.FolderInfoList
		expectedErr    string
		maxDepth       int  // defaults to 5 unless set
		pathVisibility bool // Phase 1.5 toggle (featuremgmt.FlagAuthzFolderPathVisibility); defaults to off, matching pre-Phase-1.5 behavior
	}{
		{
			name: "no parents",
			request: input{
				name: "test",
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", CanView: true},
			}},
		},
		{
			name: "has a parent",
			request: input{
				name:   "test",
				folder: "parent",
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Parent: "parent", CanView: true},
				{Name: "parent", CanView: true},
			}},
		},
		{
			name: "general has no parent",
			request: input{
				name: "general",
			},
			getter: map[string]*folders.Folder{},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "general", CanView: true},
			}},
		},
		{
			name: "error in parent",
			request: input{
				name:   "test",
				folder: "parent", // NOTE that parent is not found
			},
			setupFn: func(m *grafanarest.MockStorage) {
				var nothing *folders.Folder // needs to be an object
				m.On("Get", context.TODO(), "parent", &metav1.GetOptions{}).Return(
					nothing, fmt.Errorf("custom error message"))
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Parent: "parent", CanView: true},
				{Name: "parent", Detached: true, Description: "custom error message"},
			}},
		},
		{
			name: "parent is not a folder",
			request: input{
				name:   "test",
				folder: "parent", // not a folder
			},
			setupFn: func(m *grafanarest.MockStorage) {
				m.On("Get", context.TODO(), "parent", &metav1.GetOptions{}).Return(
					&unstructured.Unstructured{}, // not a folder
					nil).Once()
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Parent: "parent", CanView: true},
				{Name: "parent", Detached: true, Description: "expected folder, found: *unstructured.Unstructured"},
			}},
		},
		{
			name: "avoid cycles",
			request: input{
				name:   "test",
				folder: "test",
			},
			setupFn: func(m *grafanarest.MockStorage) {
				m.On("Get", context.TODO(), "test", &metav1.GetOptions{}).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Annotations: map[string]string{
								utils.AnnoKeyFolder: "test", // invalid! this will cycle
							},
						},
					}, nil).Maybe()
			},
			expectedErr: "cyclic folder references found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := grafanarest.NewMockStorage(t)
			if tt.getter == nil && tt.setupFn == nil {
				// Default to filling the getter with expected results
				for _, item := range tt.expected.Items {
					m.On("Get", context.TODO(), item.Name, &metav1.GetOptions{}).Return(
						&folders.Folder{
							ObjectMeta: metav1.ObjectMeta{
								Name: item.Name,
								Annotations: map[string]string{
									utils.AnnoKeyFolder: item.Parent,
								},
							},
							Spec: folders.FolderSpec{
								Title:       item.Title,
								Description: &item.Description,
							},
						}, nil).Maybe() // we don't care how often they are called
				}
			} else {
				for k, v := range tt.getter {
					v.Name = k // set the name
					m.On("Get", context.TODO(), k, &metav1.GetOptions{}).Return(v, nil).Maybe()
				}
				if tt.setupFn != nil {
					tt.setupFn(m)
				}
			}

			maxDepth := tt.maxDepth
			if maxDepth == 0 {
				maxDepth = 5
			}

			getter := newParentsGetter(m, maxDepth, tt.pathVisibility)
			parents, err := getter(context.TODO(), &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: tt.request.name,
					Annotations: map[string]string{
						utils.AnnoKeyFolder: tt.request.folder,
					}},
			})
			if tt.expectedErr == "" {
				require.NoError(t, err)
				require.NotNil(t, parents)
				require.ElementsMatch(t, tt.expected.Items, parents.Items)
			} else {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedErr)
			}
		})
	}
}

// isServiceIdentityCtx and isRealUserCtx are testify mock.MatchedBy predicates that distinguish
// the privileged, title-only ancestor read (#2309) from the normal, per-caller-authorized Get --
// this is the actual behavior under test, not just an artifact of the mock setup, so matching on
// it (rather than on call order) keeps the tests honest about which path fired.
func isServiceIdentityCtx(ctx context.Context) bool { return identity.IsServiceIdentity(ctx) }
func isRealUserCtx(ctx context.Context) bool        { return !identity.IsServiceIdentity(ctx) }

// TestParents_PathVisibility covers Phase 1.5 (#2285 §4.5): with FlagAuthzFolderPathVisibility on,
// an inaccessible ancestor's name should still resolve (as an inert, Detached node) instead of
// stopping the whole walk, and a genuinely accessible ancestor further up the chain must still
// render as a real node -- the walk must not permanently downgrade to "ghost mode" the moment it
// hits one inaccessible ancestor.
func TestParents_PathVisibility(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1})

	newFolder := func(name, parent, title string) *folders.Folder {
		return &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name:        name,
				Annotations: map[string]string{utils.AnnoKeyFolder: parent},
			},
			Spec: folders.FolderSpec{Title: title},
		}
	}

	t.Run("inaccessible ancestor resolves via privileged read, accessible ancestor above it still renders as real", func(t *testing.T) {
		// tree: sharedRoot (root-parented, accessible) -> teamBlue (inaccessible) -> mySubfolder (the requested folder)
		sharedRoot := newFolder("sharedRoot", "", "Shared root")
		teamBlue := newFolder("teamBlue", "sharedRoot", "Team Blue")

		m := grafanarest.NewMockStorage(t)
		// The caller cannot access teamBlue through the normal, authorized path.
		m.On("Get", mock.MatchedBy(isRealUserCtx), "teamBlue", &metav1.GetOptions{}).
			Return(nil, fmt.Errorf("access denied")).Once()
		// The privileged, title-only read can still resolve its name.
		m.On("Get", mock.MatchedBy(isServiceIdentityCtx), "teamBlue", &metav1.GetOptions{}).
			Return(teamBlue, nil).Once()
		// sharedRoot is genuinely accessible -- the walk must keep trying the real, authorized
		// path at every level, not stay in ghost mode once it's used it once.
		m.On("Get", mock.MatchedBy(isRealUserCtx), "sharedRoot", &metav1.GetOptions{}).
			Return(sharedRoot, nil).Once()

		getter := newParentsGetter(m, 5, true)
		result, err := getter(ctx, newFolder("mySubfolder", "teamBlue", "My subfolder"))
		require.NoError(t, err)
		require.Equal(t, []folders.FolderInfo{
			{Name: "sharedRoot", Title: "Shared root", CanView: true},
			{Name: "teamBlue", Title: "Team Blue", Parent: "sharedRoot", Detached: true},
			{Name: "mySubfolder", Title: "My subfolder", Parent: "teamBlue", CanView: true},
		}, result.Items)
	})

	t.Run("multiple consecutive inaccessible ancestors all resolve, not just the nearest one", func(t *testing.T) {
		// tree: root (root-parented, inaccessible) -> teamBlue (inaccessible) -> mySubfolder
		root := newFolder("root", "", "Org root")
		teamBlue := newFolder("teamBlue", "root", "Team Blue")

		m := grafanarest.NewMockStorage(t)
		m.On("Get", mock.MatchedBy(isRealUserCtx), "teamBlue", &metav1.GetOptions{}).
			Return(nil, fmt.Errorf("access denied")).Once()
		m.On("Get", mock.MatchedBy(isServiceIdentityCtx), "teamBlue", &metav1.GetOptions{}).
			Return(teamBlue, nil).Once()
		m.On("Get", mock.MatchedBy(isRealUserCtx), "root", &metav1.GetOptions{}).
			Return(nil, fmt.Errorf("access denied")).Once()
		m.On("Get", mock.MatchedBy(isServiceIdentityCtx), "root", &metav1.GetOptions{}).
			Return(root, nil).Once()

		getter := newParentsGetter(m, 5, true)
		result, err := getter(ctx, newFolder("mySubfolder", "teamBlue", "My subfolder"))
		require.NoError(t, err)
		require.Equal(t, []folders.FolderInfo{
			{Name: "root", Title: "Org root", Detached: true},
			{Name: "teamBlue", Title: "Team Blue", Parent: "root", Detached: true},
			{Name: "mySubfolder", Title: "My subfolder", Parent: "teamBlue", CanView: true},
		}, result.Items)
	})

	t.Run("privileged read also failing falls back to the same detached placeholder as toggle-off", func(t *testing.T) {
		m := grafanarest.NewMockStorage(t)
		m.On("Get", mock.MatchedBy(isRealUserCtx), "teamBlue", &metav1.GetOptions{}).
			Return(nil, fmt.Errorf("access denied")).Once()
		m.On("Get", mock.MatchedBy(isServiceIdentityCtx), "teamBlue", &metav1.GetOptions{}).
			Return(nil, fmt.Errorf("not found")).Once()

		getter := newParentsGetter(m, 5, true)
		result, err := getter(ctx, newFolder("mySubfolder", "teamBlue", "My subfolder"))
		require.NoError(t, err)
		require.Equal(t, []folders.FolderInfo{
			{Name: "teamBlue", Detached: true, Description: "not found"},
			{Name: "mySubfolder", Title: "My subfolder", Parent: "teamBlue", CanView: true},
		}, result.Items)
	})

	t.Run("guardrail: the privileged read never returns anything beyond uid/title/parent/description", func(t *testing.T) {
		desc := "a description"
		teamBlue := newFolder("teamBlue", "sharedRoot", "Team Blue")
		teamBlue.Spec.Description = &desc
		// Deliberately pollute the source object with fields getAncestorTitleOnly must never
		// carry over -- labels, extra annotations, finalizers, a resource version. If any of
		// these leaked through, this test would catch it via the exact-equality check below.
		teamBlue.Labels = map[string]string{"secret-label": "must-not-leak"}
		teamBlue.Annotations["unrelated-annotation"] = "must-not-leak"
		teamBlue.Finalizers = []string{"must-not-leak"}
		teamBlue.ResourceVersion = "12345"

		m := grafanarest.NewMockStorage(t)
		m.On("Get", mock.MatchedBy(isServiceIdentityCtx), "teamBlue", &metav1.GetOptions{}).Return(teamBlue, nil).Once()

		ghost, err := getAncestorTitleOnly(ctx, m, "teamBlue")
		require.NoError(t, err)

		expected := &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{Name: "teamBlue"},
			Spec:       folders.FolderSpec{Title: "Team Blue", Description: &desc},
		}
		expectedMeta, _ := utils.MetaAccessor(expected)
		expectedMeta.SetFolder("sharedRoot")
		require.Equal(t, expected, ghost)
	})

	t.Run("guardrail: siblings of a ghost ancestor never appear in the resolved path", func(t *testing.T) {
		// tree: sharedRoot -> {teamBlue (inaccessible, on the path), teamRed (an unrelated sibling)}
		sharedRoot := newFolder("sharedRoot", "", "Shared root")
		teamBlue := newFolder("teamBlue", "sharedRoot", "Team Blue")

		m := grafanarest.NewMockStorage(t)
		m.On("Get", mock.MatchedBy(isRealUserCtx), "teamBlue", &metav1.GetOptions{}).
			Return(nil, fmt.Errorf("access denied")).Once()
		m.On("Get", mock.MatchedBy(isServiceIdentityCtx), "teamBlue", &metav1.GetOptions{}).
			Return(teamBlue, nil).Once()
		m.On("Get", mock.MatchedBy(isRealUserCtx), "sharedRoot", &metav1.GetOptions{}).
			Return(sharedRoot, nil).Once()
		// No expectation is registered for "teamRed" at all -- if the walk ever asked about it
		// (real or privileged path), the mock would fail this test outright for an unexpected
		// call, which is exactly the guarantee this test wants: the walk only ever resolves the
		// one ancestor chain it was asked about, never a folder's other children.

		getter := newParentsGetter(m, 5, true)
		result, err := getter(ctx, newFolder("mySubfolder", "teamBlue", "My subfolder"))
		require.NoError(t, err)
		require.Len(t, result.Items, 3)
		for _, item := range result.Items {
			require.NotEqual(t, "teamRed", item.Name)
		}
	})

	t.Run("cyclic reference through a ghost ancestor is still detected", func(t *testing.T) {
		// teamBlue (inaccessible, ghost) claims mySubfolder as its own parent -- a cycle.
		teamBlue := newFolder("teamBlue", "mySubfolder", "Team Blue")

		m := grafanarest.NewMockStorage(t)
		m.On("Get", mock.MatchedBy(isRealUserCtx), "teamBlue", &metav1.GetOptions{}).
			Return(nil, fmt.Errorf("access denied")).Maybe()
		m.On("Get", mock.MatchedBy(isServiceIdentityCtx), "teamBlue", &metav1.GetOptions{}).
			Return(teamBlue, nil).Maybe()

		getter := newParentsGetter(m, 5, true)
		_, err := getter(ctx, newFolder("mySubfolder", "teamBlue", "My subfolder"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "cyclic folder references found")
	})
}
