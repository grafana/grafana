---
description: Learn how to generate a data source diagnostic bundle and send it to Grafana Labs support for troubleshooting
keywords:
  - grafana
  - troubleshooting
  - support
  - data sources
  - diagnostics
labels:
  products:
    - enterprise
    - oss
menutitle: Generate a diagnostic bundle
title: Generate a data source diagnostic bundle to send to Grafana Labs support
weight: 200
---

# Generate a data source diagnostic bundle

{{< admonition type="note" >}}
On-demand data source diagnostics is an [experimental](https://grafana.com/docs/release-life-cycle/#experimental) feature that helps you share troubleshooting evidence with Grafana Labs Technical Support. The feature is disabled by default. To switch it on, refer to [Enable the feature toggle](#enable-the-feature-toggle).
{{< /admonition >}}

When a panel returns an error, no data, or data that looks wrong, Grafana Labs Technical Support needs to know what your data source actually returned. In Grafana Cloud, you can grant support access to your stack and let an engineer investigate the unexpected behavior live. In a self-managed instance, that isn't possible, because support has no way to reach your environment. A diagnostic bundle closes that gap: you collect the evidence yourself and share it with support.

When you generate a diagnostic bundle, Grafana re-runs the panel's queries with traffic capture active and packages the result as a single `.tar.gz` file containing the requests and responses exchanged with your data source, the data the data source plugin returned to Grafana, the panel and dashboard configuration, and other useful metadata.

{{< admonition type="warning" >}}
A diagnostic bundle records upstream traffic and error messages verbatim, without redaction. Request headers, query parameters, request and response bodies, and error text are all stored as they occurred, so a bundle can contain authentication tokens, passwords, and the contents of the data your queries returned.

Treat a bundle as you would treat a credential. **Review it before you share it**, and **send it only to Grafana Labs Technical Support**, through your Grafana Labs support ticket.
{{< /admonition >}}

## Before you begin

To generate a diagnostic bundle, you need the following:

- A self-managed Grafana instance. Diagnostic bundles aren't available in Grafana Cloud.
- The Grafana server administrator role. The menu items described on this page don't appear for other users.
- The `grafana.onDemandDiagnostics` feature toggle enabled.

### Enable the feature toggle

The `grafana.onDemandDiagnostics` feature toggle is disabled by default. While it's disabled, Grafana hides the diagnostics UI elements and the underlying endpoints return `404`.

To enable it, add the following to your Grafana configuration file and restart Grafana:

```ini
[feature_toggles]
enable = grafana.onDemandDiagnostics
```

For the other ways to set a feature toggle, including environment variables, refer to [the `feature_toggles` section of Configure Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles) and [Manage feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/feature-toggles/#manage-feature-toggles).

## Generate a bundle for a single panel

1. Open the dashboard that contains the panel you want to diagnose.

1. Hover over any part of the panel to display the panel menu in the top right corner.

1. Click the menu and select **More** > **Download diagnostics**.

   Grafana opens a drawer describing what the bundle contains, including a **May contain sensitive data** warning.

1. Click **Download diagnostics**.

   Grafana re-runs the panel's queries with capture active and downloads the bundle. The button reads **Generating…** while this happens, which can take a moment.

1. Review the bundle, then attach it to your support ticket.

## Generate a bundle for an entire dashboard

Use a dashboard bundle when you don't know which panel is at fault, or when the problem involves more than one panel.

1. Open the dashboard you want to diagnose.

1. In the dashboard toolbar, click **Export** > **Download diagnostics**.

1. Click **Download diagnostics**.

   Grafana captures the panels one at a time and reports how many it has captured so far, for example **Capturing panel 3 of 12**. Large dashboards can take a while.

1. Review the bundle, then attach it to your support ticket.

Grafana captures each panel independently, so one failing panel doesn't prevent the rest of the bundle from being produced. Panels that were skipped or that failed are recorded in `manifest.json`.

## What the bundle contains

Extract the bundle to review it:

```bash
tar -xzf <bundle>.tar.gz
```

A single-panel bundle contains the following files:

| File                  | Contents                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `traffic.har`         | The HTTP requests and responses exchanged with the data source, in [HAR 1.2](http://www.softwareishard.com/blog/har-12-spec/) format, including bodies and timings. Connection failures are recorded as an entry with a comment. Not available for every data source; refer to [Data source support for capturing upstream traffic](#data-source-support-for-capturing-upstream-traffic). |
| `querydata.json`      | The queries Grafana submitted and the data the data source plugin returned, including per-query status, errors, and the schema and values of each returned frame. Large responses are reduced to a summary that records what was truncated.                                                                                                                                               |
| `query-error.txt`     | The query error text, when the queries failed.                                                                                                                                                                                                                                                                                                                                            |
| `querydata-error.txt` | Present only when the query data couldn't be written. The rest of the bundle is still produced.                                                                                                                                                                                                                                                                                           |
| `panel.json`          | The panel configuration: queries, transformations, field options, and visualization settings.                                                                                                                                                                                                                                                                                             |
| `dashboard.json`      | The dashboard configuration, for context.                                                                                                                                                                                                                                                                                                                                                 |

A dashboard bundle contains a `panels/<id>-<title>/` directory holding those files for each panel, plus a `manifest.json` recording when the bundle was generated, how many panels ran, and the data sources, sizes, and any errors for each panel.

`panel.json` and `dashboard.json` describe how Grafana fetches and renders your data. Every other file records what happened during the capture.

## Data source support for capturing upstream traffic

`traffic.har` is usually the most valuable file in the bundle, and it isn't available for every data source. Grafana still generates the rest of the bundle when upstream traffic can't be captured, and `querydata.json` still shows what the data source plugin returned.

### Data sources that capture upstream traffic

The following data sources are built into Grafana and capture their upstream traffic with no extra configuration:

- Prometheus
- Graphite
- InfluxDB
- Azure Monitor

### Data sources that don't capture upstream traffic

- **SQL and other database data sources**, including MySQL, PostgreSQL, Microsoft SQL Server, and MongoDB. These communicate over a database wire protocol rather than HTTP, so there's no HTTP exchange to record.
- **Amazon CloudWatch.** Queries are issued through the AWS SDK, which doesn't use the instrumented HTTP client that capture relies on.

## Limitations

As an experimental feature, on-demand data source diagnostics currently has the following limitations:

- **Grafana re-runs your queries.** A bundle reflects a fresh execution at the moment you generate it, not the original failure, and it bypasses the query cache. An intermittent failure might not reproduce, so a healthy-looking bundle doesn't prove the problem is resolved.

- **Queries run as you.** Because you generate the bundle as a server administrator, a failure that depends on the affected user's identity, such as per-user OAuth forwarding or row-level database permissions, might not reproduce. If a specific user is affected, say so in your ticket.

- **Only panel and dashboard queries are captured.** Failures in the variable picker, in a data source's **Save & test** button, in annotation queries, or during alert rule evaluation don't appear in a bundle.

- **Data beyond the data source isn't captured.** Server-side expressions and panel transformations are recorded as configuration in `panel.json`, not as the data flowing between them. If `querydata.json` looks correct but the panel doesn't, the cause lies in that configuration.

- **Query data is capped, and oversized query data is summarized.** `querydata.json` is limited to 8 MiB for a single panel and 32 MiB across a whole-dashboard bundle. Query data above that limit is replaced by a summary that records what was left out, rather than being dropped without trace. If a dashboard bundle uses up its budget, the remaining panels' query data is skipped and the reason is recorded in `manifest.json`.

- **Captured traffic is capped for plugin data sources.** For data sources that run as plugins, Grafana captures at most 8 MiB per request or response body, and 32 MiB of body text across the whole capture. A body that exceeded the per-body limit is recorded with a size of `-1`, and once the total is reached, later bodies are stored empty. An empty body in `traffic.har` therefore doesn't always mean the response was empty. If a bundle hits these limits, reproduce the problem on a small, temporary test dashboard or panel and generate the bundle from that instead.

## Related documentation

- [Send a panel to Grafana Labs support](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/troubleshooting/send-panel-to-grafana-support/)
- [Generate a HAR capture to send to Grafana Labs support](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/troubleshooting/har-captures/)
- [Troubleshoot data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/troubleshooting/)
