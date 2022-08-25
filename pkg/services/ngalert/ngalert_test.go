package ngalert

import (
	"context"
	"math/rand"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	busmock "github.com/grafana/grafana/pkg/bus/mock"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/log"
	models2 "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
)

func Test_subscribeToFolderChanges(t *testing.T) {
	orgID := rand.Int63()
	folder := &models2.Folder{
		Id:    0,
		Uid:   util.GenerateShortUID(),
		Title: "Folder" + util.GenerateShortUID(),
	}
	rules := models.GenerateAlertRules(5, models.AlertRuleGen(models.WithOrgID(orgID), models.WithNamespace(folder)))

	bus := busmock.New()
	db := store.NewFakeRuleStore(t)
	db.Folders[orgID] = append(db.Folders[orgID], folder)
	db.PutRule(context.Background(), rules...)

	scheduler := &schedule.FakeScheduleService{}
	scheduler.On("UpdateAlertRule", mock.Anything, mock.Anything).Return()

	subscribeToFolderChanges(log.New("test"), bus, db, scheduler)

	err := bus.Publish(context.Background(), &events.FolderTitleUpdated{
		Timestamp: time.Now(),
		Title:     "Folder" + util.GenerateShortUID(),
		ID:        folder.Id,
		UID:       folder.Uid,
		OrgID:     orgID,
	})
	require.NoError(t, err)

	require.Eventuallyf(t, func() bool {
		return len(db.GetRecordedCommands(func(cmd interface{}) (interface{}, bool) {
			c, ok := cmd.(store.GenericRecordedQuery)
			if !ok || c.Name != "IncreaseVersionForAllRulesInNamespace" {
				return nil, false
			}
			return c, true
		})) > 0
	}, time.Second, 10*time.Millisecond, "expected to call db store method but nothing was called")

	var calledTimes int
	require.Eventuallyf(t, func() bool {
		for _, call := range scheduler.Calls {
			if call.Method == "UpdateAlertRule" {
				calledTimes++
			}
		}
		return calledTimes == len(rules)
	}, time.Second, 10*time.Millisecond, "scheduler was expected to be called %d times but called %d", len(rules), calledTimes)

	for _, rule := range rules {
		scheduler.AssertCalled(t, "UpdateAlertRule", rule.GetKey(), rule.Version)
	}
}
