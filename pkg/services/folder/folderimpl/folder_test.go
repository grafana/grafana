package folderimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/tests/testsuite"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var orgID = int64(1)
var noPermUsr = &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}

func TestSupportBundle(t *testing.T) {
	f := func(uid, parent string) *folder.Folder { return &folder.Folder{UID: uid, ParentUID: parent} }
	for _, tc := range []struct {
		Folders          []*folder.Folder
		ExpectedTotal    int
		ExpectedDepths   map[int]int
		ExpectedChildren map[int]int
	}{
		// Empty folder list
		{
			Folders:          []*folder.Folder{},
			ExpectedTotal:    0,
			ExpectedDepths:   map[int]int{},
			ExpectedChildren: map[int]int{},
		},
		// Single folder
		{
			Folders:          []*folder.Folder{f("a", "")},
			ExpectedTotal:    1,
			ExpectedDepths:   map[int]int{1: 1},
			ExpectedChildren: map[int]int{0: 1},
		},
		// Flat folders
		{
			Folders:          []*folder.Folder{f("a", ""), f("b", ""), f("c", "")},
			ExpectedTotal:    3,
			ExpectedDepths:   map[int]int{1: 3},
			ExpectedChildren: map[int]int{0: 3},
		},
		// Nested folders
		{
			Folders:          []*folder.Folder{f("a", ""), f("ab", "a"), f("ac", "a"), f("x", ""), f("xy", "x"), f("xyz", "xy")},
			ExpectedTotal:    6,
			ExpectedDepths:   map[int]int{1: 2, 2: 3, 3: 1},
			ExpectedChildren: map[int]int{0: 3, 1: 2, 2: 1},
		},
	} {
		svc := &Service{}
		supportItem, err := svc.supportItemFromFolders(tc.Folders)
		if err != nil {
			t.Fatal(err)
		}

		stats := struct {
			Total    int         `json:"total"`
			Depths   map[int]int `json:"depths"`
			Children map[int]int `json:"children"`
		}{}
		if err := json.Unmarshal(supportItem.FileBytes, &stats); err != nil {
			t.Fatal(err)
		}

		if stats.Total != tc.ExpectedTotal {
			t.Error("Total mismatch", stats, tc)
		}
		if fmt.Sprint(stats.Depths) != fmt.Sprint(tc.ExpectedDepths) {
			t.Error("Depths mismatch", stats, tc.ExpectedDepths)
		}
		if fmt.Sprint(stats.Children) != fmt.Sprint(tc.ExpectedChildren) {
			t.Error("Depths mismatch", stats, tc.ExpectedChildren)
		}
	}
}
func TestSplitFullpath(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: []string{},
		},
		{
			name:     "root folder",
			input:    "/",
			expected: []string{},
		},
		{
			name:     "single folder",
			input:    "folder",
			expected: []string{"folder"},
		},
		{
			name:     "single folder with leading slash",
			input:    "/folder",
			expected: []string{"folder"},
		},
		{
			name:     "nested folder",
			input:    "folder/subfolder/subsubfolder",
			expected: []string{"folder", "subfolder", "subsubfolder"},
		},
		{
			name:     "escaped slashes",
			input:    "folder\\/with\\/slashes",
			expected: []string{"folder/with/slashes"},
		},
		{
			name:     "nested folder with escaped slashes",
			input:    "folder\\/with\\/slashes/subfolder\\/with\\/slashes",
			expected: []string{"folder/with/slashes", "subfolder/with/slashes"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := SplitFullpath(tt.input)
			assert.Equal(t, tt.expected, actual)
		})
	}
}

func TestGetUIDFromLegacyID(t *testing.T) {
	const orgID int64 = 1

	user := &user.SignedInUser{OrgID: orgID, UserID: 1}
	ctx := identity.WithRequester(context.Background(), user)

	fakeK8s := new(client.MockK8sHandler)
	store := folder.NewFakeStore()
	store.ExpectedFolder = &folder.Folder{
		UID:   "resolved-uid",
		OrgID: orgID,
		Title: "Resolved",
	}

	svc := &Service{
		k8sclient:     fakeK8s,
		unifiedStore:  store,
		accessControl: actest.FakeAccessControl{ExpectedEvaluate: true},
		tracer:        noop.NewTracerProvider().Tracer("test"),
	}

	gvr := folderv1.FolderResourceInfo.GroupVersionResource()
	searchReq := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     gvr.Group,
				Resource:  gvr.Resource,
			},
			Fields: []*resourcepb.Requirement{},
			Labels: []*resourcepb.Requirement{
				{
					Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
					Operator: string(selection.In),
					Values:   []string{"42"},
				},
			},
		},
		Limit: folderSearchLimit,
	}
	searchRes := &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
						Name:     "resolved-uid",
						Resource: "folders",
					},
					Cells: [][]byte{[]byte("")},
				},
			},
		},
		TotalHits: 1,
	}

	fakeK8s.On("GetNamespace", orgID).Return("default").Maybe()
	fakeK8s.On("Search", mock.Anything, orgID, searchReq).Return(searchRes, nil).Once()

	uid, err := svc.getUIDFromLegacyID(ctx, orgID, 42)
	require.NoError(t, err)
	require.Equal(t, "resolved-uid", uid)
	fakeK8s.AssertExpectations(t)
}
