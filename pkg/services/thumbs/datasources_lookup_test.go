package thumbs

import (
	"context"
	_ "embed"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

var (
	//go:embed testdata/search_response_frame.json
	exampleListFrameJSON string
	exampleListFrame     = &data.Frame{}
	_                    = exampleListFrame.UnmarshalJSON([]byte(exampleListFrameJSON))
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
