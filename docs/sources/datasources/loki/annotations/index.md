---
aliases:
  - ../../data-sources/loki/annotations/
description: Use Loki log events as annotations in Grafana dashboards
keywords:
  - grafana
  - loki
  - annotations
  - events
  - logs
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: Loki annotations
weight: 400
refs:
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
  configure-loki:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/
---

# Loki annotations

Annotations overlay event data on your dashboard graphs, helping you correlate log events with metrics. You can use Loki as a data source for annotations to display events such as deployments, errors, or other significant occurrences on your visualizations.

For general information about annotations, refer to [Annotate visualizations](ref:annotate-visualizations).

## Before you begin

Before creating Loki annotations, ensure you have:

- A [Loki data source configured](ref:configure-loki) in Grafana.
- Logs in Loki containing the events you want to display as annotations.
- Read access to the Loki logs you want to query.

## Create an annotation query

To add a Loki annotation to your dashboard:

1. Navigate to your dashboard and click **Dashboard settings** (gear icon).
1. Select **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Enter a **Name** for the annotation.
1. Select your **Loki** data source from the **Data source** dropdown.
1. Enter a LogQL query in the query field.
1. Configure the optional formatting fields (Title, Tags, Text).
1. Click **Save dashboard**.

## Query

Use the query field to enter a LogQL expression that filters the log events to display as annotations. Only log queries are supported for annotations; metric queries are not supported.

**Examples:**

| Query                                               | Description                                         |
| --------------------------------------------------- | --------------------------------------------------- |
| `{job="app"}`                                       | Shows all logs from the "app" job.                  |
| `{job="app"} \|= "error"`                           | Shows logs containing "error" from the "app" job.   |
| `{namespace="production"} \|= "deployed"`           | Shows deployment events in production.              |
| `{job="app"} \| logfmt \| level="error"`            | Shows error-level logs using logfmt parsing.        |
| `{job="$job"}`                                      | Uses a template variable to filter by job.          |

You can use template variables in your annotation queries to make them dynamic based on dashboard selections.

## Formatting options

Loki annotations support optional formatting fields to customize how annotations are displayed.

### Title

The **Title** field specifies a pattern for the annotation title. You can use label values by wrapping the label name in double curly braces.

- **Default:** Empty (uses the log line as the title)
- **Pattern example:** `{{instance}}` displays the value of the `instance` label
- **Pattern example:** `{{job}} - {{level}}` combines multiple labels

### Tags

The **Tags** field specifies which labels to use as annotation tags. Enter label names as a comma-separated list.

- **Default:** All labels are used as tags
- **Example:** `job,instance,level` uses only these three labels as tags

Tags help categorize and filter annotations in the dashboard.

### Text

The **Text** field specifies a pattern for the annotation text displayed when you hover over the annotation. You can use label values by wrapping the label name in double curly braces.

- **Default:** The log line content
- **Pattern example:** `{{message}}` displays the value of a parsed `message` label
- **Pattern example:** `Error on {{instance}}: {{error}}` creates a descriptive message

### Line limit

The **Line limit** field controls the maximum number of log lines returned for annotations. This helps prevent performance issues when querying logs with many results.

- **Default:** Uses the data source's configured maximum lines setting

## Example: Deployment annotations

To display deployment events as annotations:

1. Create an annotation query with the following settings:
   - **Query:** `{job="deploy-service"} |= "deployed"`
   - **Title:** `Deployment: {{app}}`
   - **Tags:** `app,environment`
   - **Text:** `{{message}}`

This configuration displays deployment logs with the application name in the title and environment as a tag.

## Example: Error annotations

To overlay error events on your metrics graphs:

1. Create an annotation query with the following settings:
   - **Query:** `{namespace="production"} | logfmt | level="error"`
   - **Title:** `{{job}} error`
   - **Tags:** `job,instance`

This configuration displays error logs from production, grouped by job and instance.

## Example: Filter annotations with template variables

To create dynamic annotations that respond to dashboard variable selections:

1. Create a template variable named `job` that queries Loki label values.
1. Create an annotation query with the following settings:
   - **Query:** `{job="$job"} |= "alert"`
   - **Title:** `Alert: {{alertname}}`
   - **Tags:** `severity`

This configuration displays only alerts for the selected job, making the annotations relevant to the current dashboard context.

