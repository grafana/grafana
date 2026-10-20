package annotationsimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	annotation_ac "github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
	tutil "github.com/grafana/grafana/pkg/util/testutil"
)

type fakeRuleGetter struct {
	rules map[string]*ngmodels.AlertRule
	err   error
	calls []string
}

func (f *fakeRuleGetter) GetAlertRuleByUID(_ context.Context, query *ngmodels.GetAlertRuleByUIDQuery) (*ngmodels.AlertRule, error) {
	f.calls = append(f.calls, query.UID)
	if f.err != nil {
		return nil, f.err
	}
	if rule, ok := f.rules[query.UID]; ok {
		return rule, nil
	}
	return nil, ngmodels.ErrAlertRuleNotFound
}

type fakeRuleLister struct {
	rules ngmodels.RulesGroup
	err   error
}

func (f *fakeRuleLister) ListAlertRules(_ context.Context, query *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error) {
	if f.err != nil {
		return nil, f.err
	}
	var result ngmodels.RulesGroup
	for _, rule := range f.rules {
		if rule.OrgID == query.OrgID {
			result = append(result, rule)
		}
	}
	return result, nil
}

func newAlertUIDTestStore(t *testing.T, getter rulestore.RuleGetter) (db.DB, *xormRepositoryImpl) {
	t.Helper()
	sqlStore := db.NewTestStore(t)
	cfg := setting.NewCfg()
	cfg.AnnotationMaximumTagsLength = 60
	return sqlStore, NewXormStore(cfg, log.New("annotation.test"), sqlStore, tagimpl.ProvideService(sqlStore), getter, prometheus.NewRegistry())
}

func addAnnotation(t *testing.T, store *xormRepositoryImpl, item annotations.Item) int64 {
	t.Helper()
	if item.OrgID == 0 {
		item.OrgID = 1
	}
	item.Epoch = 10
	require.NoError(t, store.Add(context.Background(), &item))
	return item.ID
}

func storedAlertUID(t *testing.T, sqlStore db.DB, id int64) string {
	t.Helper()
	var uid string
	require.NoError(t, sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.SQL("SELECT alert_uid FROM annotation WHERE id = ?", id).Get(&uid)
		return err
	}))
	return uid
}

func TestIntegrationAnnotationsAlertUIDWrites(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)
	sqlStore, store := newAlertUIDTestStore(t, &fakeRuleGetter{})
	ctx := context.Background()

	alert := annotations.Item{OrgID: 1, AlertUID: "rule-a", Epoch: 10}
	plain := annotations.Item{OrgID: 1, Text: "plain", Epoch: 10}
	require.NoError(t, store.Add(ctx, &alert))
	require.NoError(t, store.Add(ctx, &plain))
	assert.Equal(t, "rule-a", storedAlertUID(t, sqlStore, alert.ID))
	assert.Equal(t, "", storedAlertUID(t, sqlStore, plain.ID))

	// AddMany bulk-inserts annotations without tags, and inserts annotations with tags one by one.
	require.NoError(t, store.AddMany(ctx, []annotations.Item{
		{OrgID: 2, AlertUID: "rule-b", Epoch: 10},
		{OrgID: 2, AlertUID: "rule-c", Tags: []string{"t"}, Epoch: 10},
		{OrgID: 2, Text: "plain bulk", Epoch: 10},
	}))
	var stored []struct {
		AlertUID string `xorm:"alert_uid"`
		Text     string `xorm:"text"`
	}
	require.NoError(t, sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL("SELECT alert_uid, text FROM annotation WHERE org_id = 2 ORDER BY alert_uid").Find(&stored)
	}))
	require.Len(t, stored, 3)
	assert.Equal(t, "", stored[0].AlertUID)
	assert.Equal(t, "plain bulk", stored[0].Text)
	assert.Equal(t, "rule-b", stored[1].AlertUID)
	assert.Equal(t, "rule-c", stored[2].AlertUID)
}

func TestIntegrationAnnotationsByAlertUID(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)
	getter := &fakeRuleGetter{rules: map[string]*ngmodels.AlertRule{
		"rule-a": {UID: "rule-a", OrgID: 1, Title: "Rule A"},
	}}
	_, store := newAlertUIDTestStore(t, getter)
	ctx := context.Background()
	accRes := &annotation_ac.AccessResources{SkipAccessControlFilter: true}

	addAnnotation(t, store, annotations.Item{Text: "rule a 1", AlertUID: "rule-a"})
	addAnnotation(t, store, annotations.Item{Text: "rule a 2", AlertID: 1, AlertUID: "rule-a"})
	addAnnotation(t, store, annotations.Item{Text: "deleted rule", AlertUID: "rule-b"})
	addAnnotation(t, store, annotations.Item{Text: "orphan", AlertID: 2, AlertUID: annotations.AlertUIDRuleNotFound})
	addAnnotation(t, store, annotations.Item{Text: "not an alert"})

	t.Run("filters by alert UID and resolves the rule title once per UID", func(t *testing.T) {
		getter.calls = nil
		items, err := store.Get(ctx, annotations.ItemQuery{OrgID: 1, AlertUID: "rule-a"}, accRes)
		require.NoError(t, err)
		require.Len(t, items, 2)
		for _, item := range items {
			assert.Equal(t, "rule-a", item.AlertUID)
			assert.Equal(t, "Rule A", item.AlertName)
		}
		assert.Equal(t, []string{"rule-a"}, getter.calls)
	})

	t.Run("returns nothing for an unknown alert UID or another org", func(t *testing.T) {
		items, err := store.Get(ctx, annotations.ItemQuery{OrgID: 1, AlertUID: "unknown"}, accRes)
		require.NoError(t, err)
		assert.Empty(t, items)

		items, err = store.Get(ctx, annotations.ItemQuery{OrgID: 2, AlertUID: "rule-a"}, accRes)
		require.NoError(t, err)
		assert.Empty(t, items)
	})

	t.Run("hides the rule-not-found marker and skips its lookup", func(t *testing.T) {
		getter.calls = nil
		items, err := store.Get(ctx, annotations.ItemQuery{OrgID: 1, Type: "alert"}, accRes)
		require.NoError(t, err)
		byText := make(map[string]*annotations.ItemDTO)
		for _, item := range items {
			byText[item.Text] = item
		}
		require.Contains(t, byText, "orphan")
		assert.Equal(t, int64(2), byText["orphan"].AlertID)
		assert.Empty(t, byText["orphan"].AlertUID)
		assert.Empty(t, byText["orphan"].AlertName)
		assert.Equal(t, "rule-b", byText["deleted rule"].AlertUID)
		assert.Empty(t, byText["deleted rule"].AlertName)
		assert.ElementsMatch(t, []string{"rule-a", "rule-b"}, getter.calls)
	})

	t.Run("leaves the alert name empty when the rule lookup fails", func(t *testing.T) {
		getter.err = errors.New("boom")
		t.Cleanup(func() { getter.err = nil })
		items, err := store.Get(ctx, annotations.ItemQuery{OrgID: 1, AlertUID: "rule-a"}, accRes)
		require.NoError(t, err)
		require.Len(t, items, 2)
		assert.Empty(t, items[0].AlertName)
	})
}

func TestIntegrationAnnotationsAlertDiscriminator(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)
	_, store := newAlertUIDTestStore(t, &fakeRuleGetter{})
	ctx := context.Background()

	alertIDs := []int64{
		addAnnotation(t, store, annotations.Item{Text: "alert id, not backfilled", AlertID: 1}),
		addAnnotation(t, store, annotations.Item{Text: "alert id, orphan", AlertID: 2, AlertUID: annotations.AlertUIDRuleNotFound}),
		addAnnotation(t, store, annotations.Item{Text: "alert id and uid", AlertID: 3, AlertUID: "rule-c"}),
		addAnnotation(t, store, annotations.Item{Text: "alert uid only", AlertUID: "rule-d"}),
	}
	dashboardID := addAnnotation(t, store, annotations.Item{Text: "dashboard", DashboardUID: "dash"})
	apiIDs := []int64{
		addAnnotation(t, store, annotations.Item{Text: "api"}),
	}

	getIDs := func(t *testing.T, queryType string) []int64 {
		t.Helper()
		items, err := store.Get(ctx, annotations.ItemQuery{OrgID: 1, Type: queryType}, &annotation_ac.AccessResources{SkipAccessControlFilter: true})
		require.NoError(t, err)
		ids := make([]int64, 0, len(items))
		for _, item := range items {
			ids = append(ids, item.ID)
		}
		return ids
	}

	t.Run("type filter", func(t *testing.T) {
		assert.ElementsMatch(t, alertIDs, getIDs(t, "alert"))
		assert.ElementsMatch(t, append([]int64{dashboardID}, apiIDs...), getIDs(t, "annotation"))
	})

	t.Run("cleanup annotation types", func(t *testing.T) {
		for _, tc := range []struct {
			annotationType string
			expected       []int64
		}{
			{alertAnnotationType, alertIDs},
			{dashboardAnnotationType, []int64{dashboardID}},
			{apiAnnotationType, apiIDs},
		} {
			ids, err := store.fetchIDs(ctx, "annotation", tc.annotationType)
			require.NoError(t, err)
			assert.ElementsMatch(t, tc.expected, ids, tc.annotationType)
		}
	})
}

func TestIntegrationBackfillAlertUIDs(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)
	sqlStore, store := newAlertUIDTestStore(t, &fakeRuleGetter{})
	ctx := context.Background()
	lister := &fakeRuleLister{rules: ngmodels.RulesGroup{
		{ID: 1, UID: "rule-1", OrgID: 1},
		{ID: 2, UID: "rule-2", OrgID: 1},
		{ID: 3, UID: "rule-3", OrgID: 2},
	}}
	run := func() { BackfillAlertUIDs(ctx, sqlStore, lister, []int64{1, 2}, log.NewNopLogger()) }

	// More rows than one batch, to cover the batching loop.
	rule1IDs := make([]int64, 0, alertUIDBackfillBatchSize+1)
	for range alertUIDBackfillBatchSize + 1 {
		rule1IDs = append(rule1IDs, addAnnotation(t, store, annotations.Item{AlertID: 1}))
	}
	rule2ID := addAnnotation(t, store, annotations.Item{AlertID: 2})
	orphanID := addAnnotation(t, store, annotations.Item{AlertID: 99})
	alreadySetID := addAnnotation(t, store, annotations.Item{AlertID: 1, AlertUID: "kept"})
	plainID := addAnnotation(t, store, annotations.Item{})
	// Rule 3 belongs to org 2, so in org 1 it is an orphan.
	otherOrgRuleID := addAnnotation(t, store, annotations.Item{AlertID: 3})
	org2ID := addAnnotation(t, store, annotations.Item{OrgID: 2, AlertID: 3})

	run()

	for _, id := range rule1IDs {
		require.Equal(t, "rule-1", storedAlertUID(t, sqlStore, id))
	}
	assert.Equal(t, "rule-2", storedAlertUID(t, sqlStore, rule2ID))
	assert.Equal(t, annotations.AlertUIDRuleNotFound, storedAlertUID(t, sqlStore, orphanID))
	assert.Equal(t, "kept", storedAlertUID(t, sqlStore, alreadySetID))
	assert.Equal(t, "", storedAlertUID(t, sqlStore, plainID))
	assert.Equal(t, annotations.AlertUIDRuleNotFound, storedAlertUID(t, sqlStore, otherOrgRuleID))
	assert.Equal(t, "rule-3", storedAlertUID(t, sqlStore, org2ID))

	t.Run("a later run picks up rows written since", func(t *testing.T) {
		newID := addAnnotation(t, store, annotations.Item{AlertID: 2})
		run()
		assert.Equal(t, "rule-2", storedAlertUID(t, sqlStore, newID))
	})

	t.Run("leaves rows unfilled when the rules cannot be listed", func(t *testing.T) {
		lister.err = errors.New("boom")
		t.Cleanup(func() { lister.err = nil })
		id := addAnnotation(t, store, annotations.Item{AlertID: 1})
		run()
		assert.Equal(t, "", storedAlertUID(t, sqlStore, id))
	})
}
