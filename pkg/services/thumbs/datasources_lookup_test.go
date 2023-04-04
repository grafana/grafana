package thumbs

import (
	"context"
	_ "embed"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/searchV2"
)

var (
	//go:embed testdata/search_response_frame.json
	exampleListFrameJSON string
	exampleListFrame     = &data.Frame{}
	_                    = exampleListFrame.UnmarshalJSON([]byte(exampleListFrameJSON))

	//go:embed testdata/empty_search_response_frame.json
	listFrameJSONWithNoDatasources string
	listFrameWithNoDatasources     = &data.Frame{}
	_                              = listFrameWithNoDatasources.UnmarshalJSON([]byte(listFrameJSONWithNoDatasources))
)

func TestShouldParseUidFromSearchResponseFrame(t *testing.T) {
	searchService := &searchV2.MockSearchService{}
	dsLookup := &dsUidsLookup{
		searchService: searchService,
		crawlerAuth:   &crawlerAuth{},
		features:      featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch),
	}

	dashboardUid := "abc"
	searchService.On("IsDisabled").Return(false)
	searchService.On("DoDashboardQuery", mock.Anything, mock.Anything, mock.Anything, searchV2.DashboardQuery{
		UIDs: []string{dashboardUid},
	}).Return(&backend.DataResponse{
		Frames: []*data.Frame{exampleListFrame},
	})

	uids, err := dsLookup.getDatasourceUidsForDashboard(context.Background(), dashboardUid, 1)
	require.NoError(t, err)
	require.Equal(t, []string{"datasource-2", "datasource-3", "datasource-4"}, uids)
}

func TestShouldReturnEmptyArrayIfThereAreNoDatasources(t *testing.T) {
	searchService := &searchV2.MockSearchService{}
	dsLookup := &dsUidsLookup{
		searchService: searchService,
		crawlerAuth:   &crawlerAuth{},
		features:      featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch),
	}

	dashboardUid := "abc"
	searchService.On("IsDisabled").Return(false)
	searchService.On("DoDashboardQuery", mock.Anything, mock.Anything, mock.Anything, searchV2.DashboardQuery{
		UIDs: []string{dashboardUid},
	}).Return(&backend.DataResponse{
		Frames: []*data.Frame{listFrameWithNoDatasources},
	})

	uids, err := dsLookup.getDatasourceUidsForDashboard(context.Background(), dashboardUid, 1)
	require.NoError(t, err)
	require.Equal(t, []string{}, uids)
	require.NotNil(t, uids)
}

func TestShouldReturnNullIfSearchServiceIsDisabled(t *testing.T) {
	searchService := &searchV2.MockSearchService{}
	dsLookup := &dsUidsLookup{
		searchService: searchService,
		crawlerAuth:   &crawlerAuth{},
		features:      featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch),
	}

	dashboardUid := "abc"
	searchService.On("IsDisabled").Return(true)
	uids, err := dsLookup.getDatasourceUidsForDashboard(context.Background(), dashboardUid, 1)
	require.NoError(t, err)
	require.Nil(t, uids)
}
