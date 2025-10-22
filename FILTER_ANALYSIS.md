# Comprehensive Filter Analysis

## Query Parameters - Complete Inventory

### ✅ Backend Filters (Passed to Store - No Performance Issues)

All these filters are correctly applied at the store level BEFORE pagination:

| Parameter          | Type   | Purpose               | Store Field       | Notes                                   |
| ------------------ | ------ | --------------------- | ----------------- | --------------------------------------- |
| `folder_uid`       | string | Filter by folder      | `NamespaceUIDs`   | Exact match                             |
| `dashboard_uid`    | string | Filter by dashboard   | `DashboardUID`    | Exact match, requires panel_id          |
| `panel_id`         | int64  | Filter by panel       | `PanelID`         | Exact match, requires dashboard_uid     |
| `receiver_name`    | string | Filter by receiver    | `ReceiverName`    | Exact match                             |
| `type`             | enum   | alerting/recording    | `RuleType`        | Enum filter                             |
| `matcher`          | array  | Label matchers        | `Labels`          | Prometheus label matchers               |
| `namespace`        | string | Filter by folder name | `Namespace`       | **Case-insensitive substring**          |
| `rule_group`       | string | Filter by group name  | `GroupName`       | **Case-insensitive substring** ✅ FIXED |
| `rule_name`        | string | Filter by rule title  | `RuleName`        | **Case-insensitive substring**          |
| `hide_plugins`     | bool   | Hide plugin rules     | `HidePluginRules` | Boolean filter                          |
| `datasource_uid`   | array  | Filter by datasource  | `DatasourceUIDs`  | Multiple exact matches                  |
| `group_limit`      | int64  | Max groups            | `Limit`           | Pagination limit                        |
| `group_next_token` | string | Pagination cursor     | `ContinueToken`   | Pagination token                        |

**Result:** All backend filters work efficiently with AlertRuleLite caching. No filters disable store-level pagination.

---

## ⚠️ Post-Fetch Filters (Applied After Store Query)

These filters are applied AFTER fetching from the store, working on the already-paginated result set:

### 1. `state` - Alert State Filter

- **Applied at:** Lines 694-696 in `PrepareRuleGroupStatusesV2`
- **Effect:** Filters **rules within groups** by alert state (firing, pending, normal, recovering, nodata, error)
- **Performance Impact:** ✅ None - pagination already happened
- **UX Impact:** ⚠️ Groups with zero matching rules are dropped from response
- **Example:** `?state=firing` returns only rules with firing alerts

### 2. `health` - Rule Health Filter

- **Applied at:** Lines 698-700 in `PrepareRuleGroupStatusesV2`
- **Effect:** Filters **rules within groups** by health status (ok, error, nodata, unknown)
- **Performance Impact:** ✅ None - pagination already happened
- **UX Impact:** ⚠️ Groups with zero matching rules are dropped from response
- **Example:** `?health=error` returns only rules with errors

### 3. `limit_rules` - Rules Per Group Limit

- **Applied at:** Lines 702-704 in `PrepareRuleGroupStatusesV2`
- **Effect:** Limits number of **rules shown per group**
- **Performance Impact:** ✅ None - pagination already happened
- **UX Impact:** ℹ️ Groups show max N rules
- **Example:** `?limit_rules=10` shows first 10 rules in each group

### 4. `limit_alerts` - Alerts Per Rule Limit

- **Applied at:** Line 691 (passed to `toRuleGroup`), then 1088-1094
- **Effect:** Limits number of **alerts shown per rule**
- **Performance Impact:** ✅ None - pagination already happened
- **UX Impact:** ℹ️ Rules show max N alerts
- **Example:** `?limit_alerts=50` shows first 50 alerts per rule

---

## Why Post-Fetch Filters Don't Cause Performance Issues

**Key Difference from the `rule_group` Bug:**

### Before Fix (THE BUG):

```
?rule_group=10&group_limit=100

1. API checks: rule_group filter present
2. API disables pagination: storeLevelLimit = 0  ← PROBLEM!
3. Store fetches ALL 47,000 rules
4. API filters by rule_group
5. API paginates to 100 groups
Time: 2500ms 💥
```

### After Fix:

```
?rule_group=10&group_limit=100

1. API passes rule_group to store
2. Store filters lite rules by GroupName
3. Store paginates to 100 groups
4. Store fetches only those ~300 full rules
Time: 350ms ✅
```

### Post-Fetch Filters (state/health/limits):

```
?state=firing&group_limit=100

1. Store fetches 100 groups (~300 rules)
2. API processes all 300 rules
3. API filters rules within groups by state
4. API drops empty groups
Result: Might return <100 groups, but still fast ✅
```

**Post-fetch filters work on a SMALL, already-paginated dataset.**

---

## API Versions

There are TWO implementations in the codebase:

### 1. PrepareRuleGroupStatusesV2 (NEW - With Caching)

- **Function:** Lines 480-758
- **Store Method:** `ListAlertRulesByGroup` (with AlertRuleLite cache)
- **All filters:** Passed to store ✅
- **Status:** **FIXED** ✅

### 2. PrepareRuleGroupStatuses (OLD - Without Caching)

- **Function:** Lines 760-913
- **Store Method:** `ListAlertRules` (no caching)
- **Filters:** Different parameter model
  - Uses `RuleGroups` (array, exact match) instead of `GroupName` (substring)
  - Uses `rule_name` in-memory filtering (lines 852-856, 941-944)
- **Status:** Legacy, no caching optimization

---

## Potential UX Issue with Post-Fetch Filters

When using `state` or `health` filters with `group_limit`:

**Scenario:**

```bash
curl '?state=firing&group_limit=100'
```

**What happens:**

1. Store returns 100 groups (e.g., 300 rules total)
2. API filters each group's rules by state=firing
3. Some groups end up with 0 firing rules
4. Empty groups are dropped (line 706-712)
5. **Response might contain only 60 groups** (not 100!)

**Is this a problem?**

- ✅ Performance: NO - still only fetched 300 rules, not 47k
- ⚠️ UX: YES - pagination doesn't guarantee exact count
- 🤔 Expected behavior? Arguably yes - if a group has no matching rules, should it appear?

**To fix this UX issue would require:**

1. Passing state/health filters to store layer
2. Store filtering AlertRuleLite by state/health BEFORE pagination
3. BUT: State/health come from state manager, not database!
4. This would require major architectural changes

---

## Summary

### ✅ NO OTHER FILTERS CAN CAUSE THE PERFORMANCE ISSUE WE FIXED

All backend-filterable parameters are now correctly passed to the store:

- ✅ `rule_group` - FIXED, now passed as `GroupName`
- ✅ `namespace` - Already passed as `Namespace`
- ✅ `rule_name` - Already passed as `RuleName`
- ✅ `type` - Already passed as `RuleType`
- ✅ `matcher` - Already passed as `Labels`
- ✅ `folder_uid`, `dashboard_uid`, `panel_id`, `receiver_name`, `hide_plugins`, `datasource_uid` - All passed correctly

### Post-Fetch Filters Are Intentional

The `state`, `health`, `limit_rules`, and `limit_alerts` filters are applied after fetching because:

1. They filter **within** groups, not the groups themselves
2. State/health data comes from the state manager, not the database
3. They work on small, already-paginated datasets
4. No performance impact

---

## Testing Checklist

To verify no filters can disable pagination:

```bash
# All these should perform similarly (~350ms on cache hit):

# No filter
curl '?group_limit=100'

# Backend filters (all fast)
curl '?rule_group=test&group_limit=100'
curl '?namespace=prod&group_limit=100'
curl '?rule_name=cpu&group_limit=100'
curl '?type=alerting&group_limit=100'
curl '?hide_plugins=true&group_limit=100'
curl '?datasource_uid=xyz&group_limit=100'
curl '?folder_uid=abc&group_limit=100'

# Post-fetch filters (still fast, might return <100 groups)
curl '?state=firing&group_limit=100'
curl '?health=error&group_limit=100'
curl '?limit_rules=5&group_limit=100'

# Combined filters (still fast)
curl '?rule_group=test&state=firing&group_limit=100'
```

All requests should complete in similar time because pagination is never disabled.
