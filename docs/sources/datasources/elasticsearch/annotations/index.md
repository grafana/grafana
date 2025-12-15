---
aliases:
  - ../../data-sources/elasticsearch/annotations/
description: Using annotations with Elasticsearch in Grafana
keywords:
  - grafana
  - elasticsearch
  - annotations
  - events
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: Elasticsearch annotations
weight: 500
refs:
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
---

# Elasticsearch annotations

Annotations overlay event data on your dashboard graphs, helping you correlate log events with metrics.
You can use Elasticsearch as a data source for annotations to display events such as deployments, alerts, or other significant occurrences on your visualizations.

For general information about annotations, refer to [Annotate visualizations](ref:annotate-visualizations).

## Before you begin

Before creating Elasticsearch annotations, ensure you have:

- An Elasticsearch data source configured in Grafana
- Documents in Elasticsearch containing event data with timestamp fields
- Read access to the Elasticsearch index containing your events

## Create an annotation query

To add an Elasticsearch annotation to your dashboard:

1. Navigate to your dashboard and click **Dashboard settings** (gear icon).
1. Select **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Enter a **Name** for the annotation.
1. Select your **Elasticsearch** data source from the **Data source** drop-down.
1. Configure the annotation query and field mappings.
1. Click **Save dashboard**.

## Query

Use the query field to filter which Elasticsearch documents appear as annotations. The query uses [Lucene query syntax](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html#query-string-syntax).

**Examples:**

| Query                                    | Description                                          |
| ---------------------------------------- | ---------------------------------------------------- |
| `*`                                      | Matches all documents.                               |
| `type:deployment`                        | Shows only deployment events.                        |
| `level:error OR level:critical`          | Shows error and critical events.                     |
| `service:api AND environment:production` | Shows events for a specific service and environment. |
| `tags:release`                           | Shows events tagged as releases.                     |

You can use template variables in your annotation queries. For example, `service:$service` filters annotations based on the selected service variable.

## Field mappings

Field mappings tell Grafana which Elasticsearch fields contain the annotation data.

### Time

The **Time** field specifies which field contains the annotation timestamp.

- **Default:** `@timestamp`
- **Format:** The field must contain a date value that Elasticsearch recognizes.

### Time End

The **Time End** field specifies a field containing the end time for range annotations. Range annotations display as a shaded region on the graph instead of a single vertical line.

- **Default:** Empty (single-point annotations)
- **Use case:** Display maintenance windows, incidents, or any event with a duration.

### Text

The **Text** field specifies which field contains the annotation description displayed when you hover over the annotation.

- **Default:** `tags`
- **Tip:** Use a descriptive field like `message`, `description`, or `summary`.

### Tags

The **Tags** field specifies which field contains tags for the annotation. Tags help categorize and filter annotations.

- **Default:** Empty
- **Format:** The field can contain either a comma-separated string or an array of strings.

## Example: Deployment annotations

To display deployment events as annotations:

1. Create an annotation query with the following settings:
   - **Query:** `type:deployment`
   - **Time:** `@timestamp`
   - **Text:** `message`
   - **Tags:** `environment`

This configuration displays deployment events with their messages as the annotation text and environments as tags.

## Example: Range annotations for incidents

To display incidents with duration:

1. Create an annotation query with the following settings:
   - **Query:** `type:incident`
   - **Time:** `start_time`
   - **Time End:** `end_time`
   - **Text:** `description`
   - **Tags:** `severity`

This configuration displays incidents as shaded regions from their start time to end time.
