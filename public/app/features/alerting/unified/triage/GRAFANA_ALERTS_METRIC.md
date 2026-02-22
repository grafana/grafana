# GRAFANA_ALERTS Metric Analysis

Reference documentation for the `GRAFANA_ALERTS` Prometheus metric shape, based on a live Grafana instance analysis.

## Metric Overview

- **Source**: Grafana's built-in Prometheus datasource (configured via `unifiedAlerting.stateHistory`)
- **Shape**: One series per alert instance (unique combination of labels)
- **Example**: 102 series total — 98 firing, 4 pending, across 55 alert rules in 15 folders

## Label Categories

### Internal Labels (6)

Always present on every series. Excluded from user-facing dropdowns:

| Label                | Description                           |
| -------------------- | ------------------------------------- |
| `__name__`           | Metric name (`GRAFANA_ALERTS`)        |
| `alertname`          | Alert rule name                       |
| `alertstate`         | Prometheus state (`firing`/`pending`) |
| `grafana_alertstate` | Grafana-specific state                |
| `grafana_folder`     | Folder name                           |
| `grafana_rule_uid`   | Unique rule identifier                |

### User-Defined Labels

Applied by alert rule authors. Coverage varies widely across instances:

- **High coverage** (~20%+): Commonly `team`, `service_name`
- **Medium coverage** (~10-20%): `severity`, `orgID`, `group`
- **Low coverage** (<10%): Domain-specific labels

The "Frequent" group in the filter dropdown dynamically surfaces the top 5 most popular user-defined labels.

## Query Patterns

### Fetching series (used by `fetchTopLabelKeys`)

```
GET /api/v1/series?match[]=GRAFANA_ALERTS&start=<unix>&end=<unix>
```

Returns all series with their full label sets. Used to count label key frequency.

### Fetching label keys (used by `fetchTagKeys`)

Uses the datasource `getTagKeys` method scoped to the metric via a PromQL query.

### Fetching label values (used by `fetchTagValues`)

Uses the datasource `getTagValues` method scoped to the metric.

## Deduplication

The triage view uses `by (alertname, grafana_folder)` to deduplicate series — collapsing multiple instances of the same rule into a single row.
