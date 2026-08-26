package export

import (
	"context"
	"fmt"
	"testing"
	"time"

	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	provisioningV0 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// historyClientStub records the list options it was called with so tests can
// assert that history is requested through the documented selectors.
type historyClientStub struct {
	dynamic.ResourceInterface
	items    []unstructured.Unstructured
	pages    [][]unstructured.Unstructured // when set, served one page per List call
	calls    []metav1.ListOptions
	lastOpts metav1.ListOptions
	err      error
}

func (m *historyClientStub) List(_ context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	m.calls = append(m.calls, opts)
	m.lastOpts = opts
	if m.err != nil {
		return nil, m.err
	}
	if m.pages == nil {
		return &unstructured.UnstructuredList{Items: m.items}, nil
	}

	page := len(m.calls) - 1
	if page >= len(m.pages) {
		return &unstructured.UnstructuredList{}, nil
	}
	list := &unstructured.UnstructuredList{Items: m.pages[page]}
	if page+1 < len(m.pages) {
		list.SetContinue(fmt.Sprintf("page-%d", page+1))
	}
	return list, nil
}

func versionAt(name, resourceVersion string, updated time.Time) unstructured.Unstructured {
	item := createDashboardObject(name)
	item.SetResourceVersion(resourceVersion)
	if !updated.IsZero() {
		meta, err := utils.MetaAccessor(&item)
		if err == nil {
			meta.SetUpdatedTimestamp(&updated)
		}
	}
	return item
}

func TestListHistory(t *testing.T) {
	t.Run("requests the history source for a single resource", func(t *testing.T) {
		client := &historyClientStub{}

		_, err := listHistory(context.Background(), client, "abc")
		require.NoError(t, err)

		require.Equal(t, utils.LabelKeyGetHistory+"=true", client.lastOpts.LabelSelector)
		require.Equal(t, "metadata.name=abc", client.lastOpts.FieldSelector)
	})

	t.Run("returns versions oldest first regardless of server order", func(t *testing.T) {
		// The server answers newest-first; the caller depends on chronological
		// order, so the sort must not rely on the response order.
		client := &historyClientStub{items: []unstructured.Unstructured{
			versionAt("abc", "300", time.Time{}),
			versionAt("abc", "100", time.Time{}),
			versionAt("abc", "200", time.Time{}),
		}}

		versions, err := listHistory(context.Background(), client, "abc")
		require.NoError(t, err)
		require.Len(t, versions, 3)
		require.Equal(t, []string{"100", "200", "300"}, []string{
			versions[0].GetResourceVersion(),
			versions[1].GetResourceVersion(),
			versions[2].GetResourceVersion(),
		})
	})

	t.Run("unparseable resource versions sort first rather than being dropped", func(t *testing.T) {
		client := &historyClientStub{items: []unstructured.Unstructured{
			versionAt("abc", "200", time.Time{}),
			versionAt("abc", "not-a-number", time.Time{}),
		}}

		versions, err := listHistory(context.Background(), client, "abc")
		require.NoError(t, err)
		require.Len(t, versions, 2)
		require.Equal(t, "not-a-number", versions[0].GetResourceVersion())
	})
}

func TestWithVersionTimestamp(t *testing.T) {
	saved := time.Date(2026, 4, 13, 10, 30, 0, 0, time.UTC)

	t.Run("dates the commit from the version's own update time", func(t *testing.T) {
		item := versionAt("abc", "100", saved)

		sig := repository.GetAuthorSignature(withVersionTimestamp(context.Background(), &item))
		require.NotNil(t, sig)
		require.True(t, saved.Equal(sig.When), "expected %s, got %s", saved, sig.When)
	})

	t.Run("keeps the identity the job already established", func(t *testing.T) {
		item := versionAt("abc", "100", saved)
		ctx := repository.WithAuthorSignature(context.Background(), repository.CommitSignature{
			Name:  "Someone",
			Email: "someone@example.com",
		})

		sig := repository.GetAuthorSignature(withVersionTimestamp(ctx, &item))
		require.NotNil(t, sig)
		require.Equal(t, "Someone", sig.Name)
		require.Equal(t, "someone@example.com", sig.Email)
		require.True(t, saved.Equal(sig.When))
	})

	t.Run("leaves the context alone when the version has no timestamp", func(t *testing.T) {
		item := versionAt("abc", "100", time.Time{})

		require.Nil(t, repository.GetAuthorSignature(withVersionTimestamp(context.Background(), &item)))
	})
}

func TestHistoryStageMode(t *testing.T) {
	require.Equal(t, repository.StageModeCommitOnEach, historyStageMode(true),
		"replaying history needs one commit per stored version")
	require.Equal(t, repository.StageModeCommitOnlyOnce, historyStageMode(false))
}

func TestExportItemHistory(t *testing.T) {
	options := provisioningV0.ExportJobOptions{}

	t.Run("writes every stored version", func(t *testing.T) {
		client := &historyClientStub{items: []unstructured.Unstructured{
			versionAt("abc", "100", time.Time{}),
			versionAt("abc", "200", time.Time{}),
		}}
		item := createDashboardObject("abc")

		repoResources := resources.NewMockRepositoryResources(t)
		repoResources.On("ResourceFilePath", mock.Anything, mock.Anything, mock.Anything).
			Return("dash.json", nil).Once()
		repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything).
			Return("abc.json", 10, nil).Twice()

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("Record", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)

		require.NoError(t, exportItemHistory(context.Background(), client, &item, options, repoResources, progress))
	})

	t.Run("a version identical to the previous one produces no commit and is not an error", func(t *testing.T) {
		client := &historyClientStub{items: []unstructured.Unstructured{
			versionAt("abc", "100", time.Time{}),
			versionAt("abc", "200", time.Time{}),
		}}
		item := createDashboardObject("abc")

		repoResources := resources.NewMockRepositoryResources(t)
		repoResources.On("ResourceFilePath", mock.Anything, mock.Anything, mock.Anything).
			Return("dash.json", nil).Once()
		repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything).
			Return("abc.json", 10, nil).Once()
		repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything).
			Return("", 0, repository.ErrNothingToCommit).Once()

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("Record", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)

		require.NoError(t, exportItemHistory(context.Background(), client, &item, options, repoResources, progress))
	})

	t.Run("falls back to the live object when nothing is stored", func(t *testing.T) {
		client := &historyClientStub{}
		item := createDashboardObject("abc")

		repoResources := resources.NewMockRepositoryResources(t)
		repoResources.On("ResourceFilePath", mock.Anything, mock.Anything, mock.Anything).
			Return("dash.json", nil).Once()
		repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything).
			Return("abc.json", 10, nil).Once()

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("Record", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)

		require.NoError(t, exportItemHistory(context.Background(), client, &item, options, repoResources, progress))
	})
}

func TestListHistory_FollowsPagination(t *testing.T) {
	// The server answers newest-first and caps a page, so stopping at the first
	// page would drop the oldest versions -- the ones this feature exists for.
	client := &historyClientStub{pages: [][]unstructured.Unstructured{
		{versionAt("abc", "300", time.Time{})},
		{versionAt("abc", "200", time.Time{})},
		{versionAt("abc", "100", time.Time{})},
	}}

	versions, err := listHistory(context.Background(), client, "abc")
	require.NoError(t, err)
	require.Len(t, versions, 3, "every page should be collected")
	require.Equal(t, "100", versions[0].GetResourceVersion(), "oldest first after sorting")
	require.Len(t, client.calls, 3)
	require.Equal(t, "", client.calls[0].Continue)
	require.Equal(t, "page-1", client.calls[1].Continue)
	require.Equal(t, "page-2", client.calls[2].Continue)
}

func TestExportItemHistory_PinsEveryVersionToOnePath(t *testing.T) {
	// A version's own title would otherwise decide its path, so a rename would
	// start a second file and split the history.
	client := &historyClientStub{items: []unstructured.Unstructured{
		versionAt("abc", "100", time.Time{}),
		versionAt("abc", "200", time.Time{}),
	}}
	item := createDashboardObject("abc")

	repoResources := resources.NewMockRepositoryResources(t)
	repoResources.On("ResourceFilePath", mock.Anything, mock.Anything, mock.Anything).
		Return("folder/current-title.json", nil).Once()
	repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.Anything,
		mock.MatchedBy(func(o resources.WriteOptions) bool { return o.FilePath == "folder/current-title.json" })).
		Return("folder/current-title.json", 10, nil).Twice()

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("Record", mock.Anything, mock.Anything).Return()
	progress.On("TooManyErrors").Return(nil)

	require.NoError(t, exportItemHistory(context.Background(), client, &item,
		provisioningV0.ExportJobOptions{}, repoResources, progress))
}
