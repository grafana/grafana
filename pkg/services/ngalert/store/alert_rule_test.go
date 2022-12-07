package store

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/slugify"

	"github.com/stretchr/testify/require"
	"golang.org/x/exp/rand"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationUpdateAlertRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval: time.Duration(rand.Int63n(100)) * time.Second,
		},
	}

	t.Run("should increase version", func(t *testing.T) {
		rule := createRule(t, store)
		newRule := models.CopyRule(rule)
		newRule.Title = util.GenerateShortUID()
		err := store.UpdateAlertRules(context.Background(), []models.UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})
		require.NoError(t, err)

		dbrule := &models.AlertRule{}
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			exist, err := sess.Table(models.AlertRule{}).ID(rule.ID).Get(dbrule)
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule.ID))
			return err
		})

		require.NoError(t, err)
		require.Equal(t, rule.Version+1, dbrule.Version)
	})

	t.Run("should fail due to optimistic locking if version does not match", func(t *testing.T) {
		rule := createRule(t, store)
		rule.Version-- // simulate version discrepancy

		newRule := models.CopyRule(rule)
		newRule.Title = util.GenerateShortUID()

		err := store.UpdateAlertRules(context.Background(), []models.UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})

		require.ErrorIs(t, err, ErrOptimisticLock)
	})
}

func TestIntegration_GetAlertRulesForScheduling(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)

	store := &DBstore{
		SQLStore: sqlStore,
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval: time.Duration(rand.Int63n(100)) * time.Second,
		},
	}

	rule1 := createRule(t, store)
	rule2 := createRule(t, store)

	tc := []struct {
		name         string
		rules        []string
		ruleGroups   []string
		disabledOrgs []int64
		folders      map[string]string
	}{
		{
			name:  "without a rule group filter, it returns all created rules",
			rules: []string{rule1.Title, rule2.Title},
		},
		{
			name:       "with a rule group filter, it only returns the rules that match on rule group",
			ruleGroups: []string{rule1.RuleGroup},
			rules:      []string{rule1.Title},
		},
		{
			name:         "with a filter on orgs, it returns rules that do not belong to that org",
			rules:        []string{rule1.Title},
			disabledOrgs: []int64{rule2.OrgID},
		},
		{
			name:    "with populate folders enabled, it returns them",
			rules:   []string{rule1.Title, rule2.Title},
			folders: map[string]string{rule1.NamespaceUID: rule1.Title, rule2.NamespaceUID: rule2.Title},
		},
		{
			name:         "with populate folders enabled and a filter on orgs, it only returns selected information",
			rules:        []string{rule1.Title},
			disabledOrgs: []int64{rule2.OrgID},
			folders:      map[string]string{rule1.NamespaceUID: rule1.Title},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			if len(tt.disabledOrgs) > 0 {
				store.Cfg.DisabledOrgs = map[int64]struct{}{}

				for _, orgID := range tt.disabledOrgs {
					store.Cfg.DisabledOrgs[orgID] = struct{}{}
					t.Cleanup(func() {
						delete(store.Cfg.DisabledOrgs, orgID)
					})
				}
			}

			populateFolders := len(tt.folders) > 0
			query := &models.GetAlertRulesForSchedulingQuery{
				RuleGroups:      tt.ruleGroups,
				PopulateFolders: populateFolders,
			}
			require.NoError(t, store.GetAlertRulesForScheduling(context.Background(), query))
			require.Len(t, query.ResultRules, len(tt.rules))

			r := make([]string, 0, len(query.ResultRules))
			for _, rule := range query.ResultRules {
				r = append(r, rule.Title)
			}

			require.ElementsMatch(t, r, tt.rules)

			if populateFolders {
				require.Equal(t, tt.folders, query.ResultFoldersTitles)
			}
		})
	}

}

func withIntervalMatching(baseInterval time.Duration) func(*models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.IntervalSeconds = int64(baseInterval.Seconds()) * rand.Int63n(10)
		rule.For = time.Duration(rule.IntervalSeconds*rand.Int63n(9)+1) * time.Second
	}
}

func TestIntegration_CountAlertRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)
	store := &DBstore{SQLStore: sqlStore}
	rule := createRule(t, store)

	tests := map[string]struct {
		query     *models.CountAlertRulesQuery
		expected  int64
		expectErr bool
	}{
		"basic success": {
			&models.CountAlertRulesQuery{
				NamespaceUID: rule.NamespaceUID,
				OrgID:        rule.OrgID,
			},
			1,
			false,
		},
		"successfully returning no results": {
			&models.CountAlertRulesQuery{
				NamespaceUID: "probably not a uid we'd generate",
				OrgID:        rule.OrgID,
			},
			0,
			false,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			count, err := store.CountAlertRulesInFolder(context.Background(), test.query)
			if test.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, test.expected, count)
			}
		})
	}
}

func createRule(t *testing.T, store *DBstore) *models.AlertRule {
	t.Helper()
	rule := models.AlertRuleGen(withIntervalMatching(store.Cfg.BaseInterval), models.WithUniqueID())()
	createFolder(t, store, rule.NamespaceUID, rule.Title, rule.OrgID)
	err := store.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
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

		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)

	return rule
}

func createFolder(t *testing.T, store *DBstore, namespace string, title string, orgID int64) *dashboard {
	t.Helper()

	var resultDashboard *dashboard
	err := store.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		cmd := saveFolderCommand{
			OrgId:    orgID,
			FolderId: 0,
			IsFolder: true,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": title,
			}),
		}
		dash := cmd.getDashboardModel()

		dash.setUid(namespace)

		dash.setVersion(1)
		dash.Created = time.Now()
		dash.CreatedBy = 1
		dash.Updated = time.Now()
		dash.UpdatedBy = 1

		if _, err := sess.Insert(dash); err != nil {
			return err
		}

		resultDashboard = dash

		return nil
	})

	require.NoError(t, err)

	return resultDashboard
}

type dashboard struct {
	Id       int64
	Uid      string
	Slug     string
	OrgId    int64
	GnetId   int64
	Version  int
	PluginId string

	Created time.Time
	Updated time.Time

	UpdatedBy int64
	CreatedBy int64
	FolderId  int64
	IsFolder  bool
	HasACL    bool `xorm:"has_acl"`

	Title string
	Data  *simplejson.Json
}

func (d *dashboard) setUid(uid string) {
	d.Uid = uid
	d.Data.Set("uid", uid)
}

func (d *dashboard) setVersion(version int) {
	d.Version = version
	d.Data.Set("version", version)
}

// UpdateSlug updates the slug
func (d *dashboard) updateSlug() {
	title := d.Data.Get("title").MustString()
	d.Slug = slugify.Slugify(title)
}

func newDashboardFromJson(data *simplejson.Json) *dashboard {
	dash := &dashboard{}
	dash.Data = data
	dash.Title = dash.Data.Get("title").MustString()
	dash.updateSlug()
	update := false

	if id, err := dash.Data.Get("id").Float64(); err == nil {
		dash.Id = int64(id)
		update = true
	}

	if uid, err := dash.Data.Get("uid").String(); err == nil {
		dash.Uid = uid
		update = true
	}

	if version, err := dash.Data.Get("version").Float64(); err == nil && update {
		dash.Version = int(version)
		dash.Updated = time.Now()
	} else {
		dash.Data.Set("version", 0)
		dash.Created = time.Now()
		dash.Updated = time.Now()
	}

	if gnetId, err := dash.Data.Get("gnetId").Float64(); err == nil {
		dash.GnetId = int64(gnetId)
	}

	return dash
}

type saveFolderCommand struct {
	Dashboard    *simplejson.Json `json:"dashboard" binding:"Required"`
	UserId       int64            `json:"userId"`
	Message      string           `json:"message"`
	OrgId        int64            `json:"-"`
	RestoredFrom int              `json:"-"`
	PluginId     string           `json:"-"`
	FolderId     int64            `json:"folderId"`
	IsFolder     bool             `json:"isFolder"`

	Result *dashboard
}

// GetDashboardModel turns the command into the saveable model
func (cmd *saveFolderCommand) getDashboardModel() *dashboard {
	dash := newDashboardFromJson(cmd.Dashboard)
	userId := cmd.UserId

	if userId == 0 {
		userId = -1
	}

	dash.UpdatedBy = userId
	dash.OrgId = cmd.OrgId
	dash.PluginId = cmd.PluginId
	dash.IsFolder = cmd.IsFolder
	dash.FolderId = cmd.FolderId
	dash.updateSlug()
	return dash
}
