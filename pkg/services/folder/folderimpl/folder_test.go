package folderimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
)

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

func TestNestedFolderDeleteUsesCorrectStorage(t *testing.T) {
	// This is a regression test for a bug where nestedFolderDelete was calling s.Get()
	// (which goes through the API server/unified storage) instead of s.store.Get()

	ctx := context.Background()
	tracer := noop.NewTracerProvider().Tracer("TestNestedFolderDeleteUsesCorrectStorage")

	testUID := "test-folder-uid"
	testOrgID := int64(1)
	testUser := &user.SignedInUser{UserID: 1, OrgID: testOrgID}

	testFolder := &folder.Folder{
		UID:   testUID,
		OrgID: testOrgID,
		Title: "Test Folder",
	}

	// Create fake stores - the direct store will have the folder, unified store will not
	store := folder.NewFakeStore()
	store.ExpectedFolder = testFolder          // Get will return the folder
	store.ExpectedFolders = []*folder.Folder{} // GetDescendants returns empty list
	store.ExpectedError = nil                  // No errors

	unifiedStore := folder.NewFakeStore()
	unifiedStore.ExpectedFolder = nil                     // This store doesn't have the folder
	unifiedStore.ExpectedError = folder.ErrFolderNotFound // Would return not found

	// Set up the service with both stores
	service := &Service{
		store:        store,
		unifiedStore: unifiedStore,
		tracer:       tracer,
		log:          slog.Default(),
	}

	cmd := &folder.DeleteFolderCommand{
		UID:          testUID,
		OrgID:        testOrgID,
		SignedInUser: testUser,
	}

	descendants, err := service.nestedFolderDelete(ctx, cmd)

	require.NoError(t, err, "nestedFolderDelete should succeed")
	assert.Empty(t, descendants, "Expected no descendants for this test")
	assert.True(t, store.DeleteCalled, "store Delete should have been called")
}
