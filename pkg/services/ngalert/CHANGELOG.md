# Changelog

**Please note that this is not a direct replacement of Grafana's "add to changelog" label. It is _mostly_ for internal consumption of the Alerting team that owns this part of Grafana.**

## Scope Glossary

### `[ADMIN]`
The ADMIN scope denotes a change that affect the structure and layout of this repository. This includes updates to the following:

- CODEOWNERS
- README
- DotFiles (.gitignore, .git-attributes, etc)

Anything that a developer working on this repo should be aware of from a standards and practice perspective.

### `[BUGFIX]`

The BUGFIX scope denotes a change that fixes an issue with the project in question. A BUGFIX should align the behaviour of the service with the current expected behaviour of the service. If a BUGFIX introduces new unexpected behaviour to ameliorate the issue, a corresponding FEATURE or ENHANCEMENT scope should also be added to the changelog.

### `[CHANGE]`

The CHANGE scope denotes a change that changes the expected behavior of the project while not adding new functionality or fixing an underling issue. This commonly occurs when renaming things to make them more consistent or to accommodate updated versions of vendored dependencies.

### `[FEATURE]`

The FEATURE scope denotes a change that adds new functionality to the project/service.

### `[ENHANCEMENT]`

The ENHANCEMENT scope denotes a change that improves upon the current functionality of the project/service. Generally, an enhancement is something that improves upon something that is already present. Either by making it simpler, more powerful, or more performant. For Example:

An optimization on a particular process in a service that makes it more performant
Simpler syntax for setting a configuration value, like allowing 1m instead of 60 for a duration setting.

## Order

Scopes must have an order to ensure consistency and ease of search, this helps us identify which section do we need to look for what. The order must be:

1. `[CHANGE]`
2. `[FEATURE]`
3. `[BUGFIX]`
4. `[ENHANCEMENT]`
5. `[ADMIN]`


## Grafana Alerting - main / unreleased

- [CHANGE] Rule API to reject request to update rules that affects provisioned rules #50835
- [FEATURE] Add first Grafana reserved label, grafana_folder is created during runtime and stores an alert's folder/namespace title #50262
- [FEATURE] use optimistic lock by version field when updating alert rules #50274
- [ENHANCEMENT] Scheduler: Drop ticks if rule evaluation is too slow and adds a metric grafana_alerting_schedule_rule_evaluations_missed_total to track missed evaluations per rule #48885
- [ENHANCEMENT] Ticker to tick at predictable time #50197

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
