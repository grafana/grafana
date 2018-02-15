package dashboards

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/util"
)

func TestDashboardsService(t *testing.T) {

	bus.ClearBusHandlers()

	bus.AddHandler("test", func(cmd *alerting.ValidateDashboardAlertsCommand) error {
		return nil
	})

	testCases := []struct {
		Uid   string
		Error error
	}{
		{Uid: "", Error: nil},
		{Uid: "asdf90_-", Error: nil},
		{Uid: "asdf/90", Error: util.ErrDashboardInvalidUid},
		{Uid: "asdfghjklqwertyuiopzxcvbnmasdfghjklqwertyuiopzxcvbnmasdfghjklqwertyuiopzxcvbnm", Error: util.ErrDashboardUidToLong},
	}

	repo := &DashboardRepository{}

	for _, tc := range testCases {
		dto := &SaveDashboardDTO{
			Dashboard: &models.Dashboard{Title: "title", Uid: tc.Uid},
		}

		_, err := repo.buildSaveDashboardCommand(dto)

		if err != tc.Error {
			t.Fatalf("expected %s to return %v", tc.Uid, tc.Error)
		}
	}
}
