package store

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/rand"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestUpdateAlertRules(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	store := DBstore{
		SQLStore: sqlStore,
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval: time.Duration(rand.Int63n(100)) * time.Second,
		},
	}
	createRule := func(t *testing.T) *models.AlertRule {
		t.Helper()
		rule := models.AlertRuleGen(withIntervalMatching(store.Cfg.BaseInterval))()
		err := sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			_, err := sess.Table(models.AlertRule{}).InsertOne(rule)
			if err != nil {
				return err
			}
			dbRule := &models.AlertRule{}
			exist, err := sess.Table(models.AlertRule{}).ID(rule.ID).Get(dbRule)
			if err != nil {
				return err
			}
			if !exist {
				return errors.New("cannot read inserted record")
			}
			rule = dbRule
			return nil
		})
		require.NoError(t, err)
		return rule
	}

	t.Run("should increase version", func(t *testing.T) {
		rule := createRule(t)
		newRule := models.CopyRule(rule)
		newRule.Title = util.GenerateShortUID()
		err := store.UpdateAlertRules(context.Background(), []UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})
		require.NoError(t, err)

		dbrule := &models.AlertRule{}
		err = sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			exist, err := sess.Table(models.AlertRule{}).ID(rule.ID).Get(dbrule)
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule.ID))
			return err
		})

		require.NoError(t, err)
		require.Equal(t, rule.Version+1, dbrule.Version)
	})

	t.Run("should fail due to optimistic locking if version does not match", func(t *testing.T) {
		rule := createRule(t)
		rule.Version-- // simulate version discrepancy

		newRule := models.CopyRule(rule)
		newRule.Title = util.GenerateShortUID()

		err := store.UpdateAlertRules(context.Background(), []UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})

		require.ErrorIs(t, err, ErrOptimisticLock)
	})
}

func withIntervalMatching(baseInterval time.Duration) func(*models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.IntervalSeconds = int64(baseInterval.Seconds()) * rand.Int63n(10)
		rule.For = time.Duration(rule.IntervalSeconds*rand.Int63n(9)+1) * time.Second
	}
}

func Test_getFilterByOrgsString(t *testing.T) {
	testCases := []struct {
		testName       string
		orgs           map[int64]struct{}
		expectedFilter string
		expectedArgs   []interface{}
	}{
		{
			testName:       "should return empty string if map is empty",
			orgs:           map[int64]struct{}{},
			expectedFilter: "",
			expectedArgs:   nil,
		},
		{
			testName:       "should return empty string if map is nil",
			orgs:           nil,
			expectedFilter: "",
			expectedArgs:   nil,
		},
		{
			testName: "should return correct filter if single element",
			orgs: map[int64]struct{}{
				1: {},
			},
			expectedFilter: "org_id NOT IN(?)",
			expectedArgs:   []interface{}{int64(1)},
		},
		{
			testName: "should return correct filter if many elements",
			orgs: map[int64]struct{}{
				1: {},
				2: {},
				3: {},
			},
			expectedFilter: "org_id NOT IN(?,?,?)",
			expectedArgs:   []interface{}{int64(1), int64(2), int64(3)},
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.testName, func(t *testing.T) {
			store := &DBstore{
				Cfg: setting.UnifiedAlertingSettings{
					DisabledOrgs: testCase.orgs,
				},
			}
			filter, args := store.getFilterByOrgsString()
			assert.Equal(t, testCase.expectedFilter, filter)
			assert.ElementsMatch(t, testCase.expectedArgs, args)
		})
	}
}
