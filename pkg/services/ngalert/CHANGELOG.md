# Changelog

This is not a direct replacement of Grafana's "add to changelog" label. This is a manually managed document used by docs and PMs to know what to add to "What's New" documents. Adding a PR to a changelog item is recommended but not necessary as some changes require more than one PR.

**Expected contributors: engineers once something noteworthy has been merged.**

## Scope Glossary

### `[CHANGED]`

The CHANGED label is for features that has changed in a visible/impactful way, e.g. "[CHANGED] Time series visualization added in cloud rules editor. [#54950](https://github.com/grafana/grafana/pull/54950)"

### `[NEW]`

The NEW label is for a new functionality or a change that is big enough to stand on its own feet. E.g. "[NEW] Provisioning now supports Terraform."

### `[DEPRECATED]`

The DEPRECATED label is for a feature is planned for deprecation. We should ideally tell customers about those 1 or 2 versions before removing the feature.

### `[REMOVED]`

Self explanatory.

## Next (9.3)

## 9.2

# Previous use of that CHANGELOG, will be removed soon

## Items that happened somewhere between 9.0 and 9.2

- [CHANGE] Rule API to reject request to update rules that affects provisioned rules #50835
- [FEATURE] Add first Grafana reserved label, grafana_folder is created during runtime and stores an alert's folder/namespace title #50262
- [FEATURE] use optimistic lock by version field when updating alert rules #50274
- [BUGFIX] State manager to use tick time to determine stale states #50991
- [ENHANCEMENT] Scheduler: Drop ticks if rule evaluation is too slow and adds a metric grafana_alerting_schedule_rule_evaluations_missed_total to track missed evaluations per rule #48885
- [ENHANCEMENT] Ticker to tick at predictable time #50197
- [ENHANCEMENT] Migration: Don't stop the migration when failing to parse alert rule tags #51253
- [ENHANCEMENT] Prevent evaluation if "for" shorter than "evaluate" #51797

## 9.0.0

- [ENHANCEMENT] Scheduler: Ticker expose new metrics. In legacy, metrics are prefixed with `legacy_` #47828, #48190
  - `grafana_alerting_ticker_last_consumed_tick_timestamp_seconds`
  - `grafana_alerting_ticker_next_tick_timestamp_seconds`
  - `grafana_alerting_ticker_interval_seconds`
- [ENHANCEMENT] Create folder 'General Alerting' when Grafana starts from the scratch #48866
- [ENHANCEMENT] Rule changes authorization logic to use UID folder scope instead of ID scope #48970
- [ENHANCEMENT] Scheduler: ticker to support stopping #48142
- [ENHANCEMENT] Optional custom title and description for OpsGenie #50131
- [ENHANCEMENT] Scheduler: Adds new metrics to track rules that might be scheduled #49874
  - `grafana_alerting_schedule_alert_rules `
  - `grafana_alerting_schedule_alert_rules_hash `
- [CHANGE] Scheduler: Renaming of metrics to make them consistent with similar metrics exposed by the component #49874
  - `grafana_alerting_get_alert_rules_duration_seconds` to `grafana_alerting_schedule_periodic_duration_seconds`
  - `grafana_alerting_schedule_periodic_duration_seconds` to `grafana_alerting_schedule_query_alert_rules_duration_seconds`
- [FEATURE] Indicate whether routes are provisioned when GETting Alertmanager configuration #47857
- [FEATURE] Indicate whether contact point is provisioned when GETting Alertmanager configuration #48323
- [FEATURE] Indicate whether alert rule is provisioned when GETting the rule #48458
- [FEATURE] Alert rules with associated panels will take screenshots. #49293 #49338 #49374 #49377 #49378 #49379 #49381 #49385 #49439 #49445
- [FEATURE] Persistent order of alert rules in a group #50051
- [BUGFIX] Migration: ignore alerts that do not belong to any existing organization\dashboard #49192
- [BUGFIX] Allow anonymous access to alerts #49203
- [BUGFIX] RBAC: replace create\update\delete actions for notification policies by alert.notifications:write #49185
- [BUGFIX] Fix access to alerts for Viewer role with editor permissions in folder #49270
- [BUGFIX] Alerting: Remove double quotes from double quoted matchers #50038
- [BUGFIX] Alerting: rules API to not detect difference between nil and empty map (Annotations, Labels) #50192

## 8.5.3

- [BUGFIX] Migration: Remove data source disabled property when migrating alerts #48559

## 8.5.2

- [FEATURE] Migration: Adds `force_migration` as a flag to prevent truncating the unified alerting tables as we migrate. #48526
- [BUGFIX] Use `NaN` and do not panic when captured alert values are empty #48370

## 8.5.1

- [BUGFIX] Silences: Invalid silences created through the API made grafana panic, they are now validated. #46892
- [ENHANCEMENT] Migration: Migrate each legacy notification channel to its own contact point, use nested routes to reproduce multi-channel alerts #47291

## 8.5.0

- [CHANGE] Prometheus Compatible API: Use float-like values for `api/prometheus/grafana/api/v1/alerts` and `api/prometheus/grafana/api/v1/rules` instead of the evaluation string #47216
- [CHANGE] Notification URL points to alert view page instead of alert edit page. #47752
- [BUGFIX] (Legacy) Templates: Parse notification templates using all the matches of the alert rule when going from `Alerting` to `OK` in legacy alerting #47355
- [BUGFIX] Scheduler: Fix state manager to support OK option of `AlertRule.ExecErrState` #47670
- [ENHANCEMENT] Templates: Enable the use of classic condition values in templates #46971
