---
aliases:
  - ../data-sources/opentsdb/
  - ../features/datasources/opentsdb/
  - ../features/opentsdb/
description: Guide for using OpenTSDB in Grafana
keywords:
  - grafana
  - opentsdb
  - guide
  - time series
  - tsdb
  - troubleshooting
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: OpenTSDB
title: OpenTSDB data source
weight: 1100
last_reviewed: 2026-01-28
refs:
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
---

# OpenTSDB data source

Grafana ships with support for OpenTSDB, an open source time series database built on top of HBase.
This document explains how to configure and use the OpenTSDB data source, including query editor features, template variables, annotations, and alerting.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](ref:data-source-management).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML](#provision-the-data-source) with Grafana's provisioning system.

## Before you begin

Before configuring the OpenTSDB data source, ensure you have:

- **Grafana permissions:** Organization administrator role to add data sources
- **OpenTSDB instance:** A running OpenTSDB server (version 2.1 or later recommended)
- **Network access:** Grafana server can reach the OpenTSDB HTTP API endpoint (default port 4242)
- **Suggest API:** For autocomplete functionality, enable the suggest API in OpenTSDB

## Configure the data source

To add and configure the OpenTSDB data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `OpenTSDB` in the search bar.
1. Select **OpenTSDB**.
1. Click **Add new data source** in the upper right.
1. Configure the data source settings.

### Configuration options

The following table describes the available configuration options:

| Setting | Description |
| ------- | ----------- |
| **Name** | The data source name. This is how you refer to the data source in panels and queries. |
| **Default** | Toggle to make this the default data source for new panels. |
| **URL** | The HTTP protocol, IP address, and port of your OpenTSDB server. The default port is `4242`. Example: `http://localhost:4242`. |
| **Allowed cookies** | Cookies to forward to the data source. Use this when your OpenTSDB server requires specific cookies for authentication. |
| **Timeout** | HTTP request timeout in seconds. Increase this value for slow networks or complex queries. |

### OpenTSDB settings

Configure these settings based on your OpenTSDB server version and configuration:

| Setting | Description |
| ------- | ----------- |
| **Version** | Select your OpenTSDB version. Options: `<=2.1`, `==2.2`, `==2.3`, `==2.4`. This affects available query features such as filters and fill policies. |
| **Resolution** | The resolution of your metric data. Select `second` for second-precision timestamps or `millisecond` for millisecond-precision timestamps. |
| **Lookup limit** | Maximum number of results returned by suggest and lookup API calls. Default is `1000`. Increase this if you have many metrics or tag values. |

### Verify the connection

Click **Save & test** to verify that Grafana can connect to your OpenTSDB server. A successful test confirms that the URL is correct and the server is responding.

If the test fails, refer to [Troubleshooting](#troubleshoot-opentsdb-data-source-issues) for common issues and solutions.

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

#### YAML example

The following example provisions an OpenTSDB data source with all available options:

```yaml
apiVersion: 1

datasources:
  - name: OpenTSDB
    type: opentsdb
    access: proxy
    url: http://localhost:4242
    basicAuth: false
    jsonData:
      # OpenTSDB version: 1 = <=2.1, 2 = 2.2, 3 = 2.3, 4 = 2.4
      tsdbVersion: 3
      # Resolution: 1 = second, 2 = millisecond
      tsdbResolution: 1
      # Maximum results for suggest/lookup API calls
      lookupLimit: 1000
```

The following table describes the `jsonData` fields:

| Field | Description | Values |
| ----- | ----------- | ------ |
| `tsdbVersion` | OpenTSDB version. | `1` (<=2.1), `2` (2.2), `3` (2.3), `4` (2.4) |
| `tsdbResolution` | Timestamp resolution. | `1` (second), `2` (millisecond) |
| `lookupLimit` | Maximum results for suggest and lookup API calls. | Default: `1000` |

### Provision with Terraform

You can provision the OpenTSDB data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to the [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/) documentation.

#### Terraform example

The following example provisions an OpenTSDB data source:

```hcl
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 2.0.0"
    }
  }
}

provider "grafana" {
  url  = "<YOUR_GRAFANA_URL>"
  auth = "<YOUR_SERVICE_ACCOUNT_TOKEN>"
}

resource "grafana_data_source" "opentsdb" {
  type = "opentsdb"
  name = "OpenTSDB"
  url  = "http://localhost:4242"

  json_data_encoded = jsonencode({
    # OpenTSDB version: 1 = <=2.1, 2 = 2.2, 3 = 2.3, 4 = 2.4
    tsdbVersion = 3
    # Resolution: 1 = second, 2 = millisecond
    tsdbResolution = 1
    # Maximum results for suggest/lookup API calls
    lookupLimit = 1000
  })
}
```

Replace the following placeholders:

- _`<YOUR_GRAFANA_URL>`_: Your Grafana instance URL (for example, `https://your-org.grafana.net` for Grafana Cloud)
- _`<YOUR_SERVICE_ACCOUNT_TOKEN>`_: A service account token with data source permissions

## Query editor

The query editor allows you to build OpenTSDB queries visually. The available options depend on the OpenTSDB version you configured for the data source.

To create a query:

1. Select the **OpenTSDB** data source in a panel.
1. Configure the query using the sections described in the following table.

### Query editor sections

| Section | Description |
| ------- | ----------- |
| **Metric** | Select the metric name and aggregation function. The aggregator determines how data points are combined (for example, `sum`, `avg`, `max`, `min`). |
| **Downsample** | Configure how data is downsampled to match the panel's time interval. Select an aggregator and optionally a fill policy for missing data. |
| **Filters** | (Version 2.2+) Add filters to narrow down the time series returned. Filters support wildcards and regular expressions. |
| **Tags** | Specify tag key-value pairs to filter metrics. Use `*` as a wildcard value. |
| **Rate** | Enable rate calculation to compute the rate of change. Useful for counter metrics. Configure counter options to handle counter resets. |

{{< admonition type="note" >}}
When using OpenTSDB 2.2 or later, use either Filters or Tags, not both. They are mutually exclusive, and using both together may produce unexpected results.
{{< /admonition >}}

### Aggregators

The aggregator function combines multiple time series into one. Common aggregators include:

| Aggregator | Description |
| ---------- | ----------- |
| `sum` | Sum all values at each timestamp. |
| `avg` | Average all values at each timestamp. |
| `min` | Take the minimum value at each timestamp. |
| `max` | Take the maximum value at each timestamp. |
| `dev` | Calculate the standard deviation. |
| `zimsum` | Sum values, treating missing data as zero. |
| `mimmin` | Minimum value, ignoring missing data. |
| `mimmax` | Maximum value, ignoring missing data. |

### Fill policies

Fill policies (available in OpenTSDB 2.2+) determine how to handle missing data points during downsampling:

| Policy | Description |
| ------ | ----------- |
| `none` | Don't fill missing values. |
| `nan` | Fill missing values with NaN. |
| `null` | Fill missing values with null. |
| `zero` | Fill missing values with zero. |

### Autocomplete suggestions

As you type metric names, tag names, or tag values, autocomplete suggestions appear. This feature requires the OpenTSDB suggest API to be enabled on your server.

If autocomplete isn't working, refer to [Troubleshooting](#autocomplete-doesnt-work).

## Template variables

Instead of hard-coding server, application, and sensor names in your metric queries, you can use template variables. Variables appear as drop-down menus at the top of the dashboard, making it easy to change the data being displayed.

For an introduction to template variables, refer to the [Variables](ref:variables) documentation.

### Query variable

The OpenTSDB data source supports query-type template variables that fetch values directly from OpenTSDB. Use the following syntax:

| Query | Description |
| ----- | ----------- |
| `metrics(prefix)` | Returns metric names with the specified prefix. Use an empty string for all metrics. |
| `tag_names(metric)` | Returns tag names (keys) for a specific metric. |
| `tag_values(metric, tagkey)` | Returns tag values for a specific metric and tag key. |
| `suggest_tagk(prefix)` | Returns tag names (keys) for all metrics with the specified prefix. |
| `suggest_tagv(prefix)` | Returns tag values for all metrics with the specified prefix. |

If template variables aren't populating in the **Preview of values** section, refer to [Troubleshooting](#template-variables-dont-populate).

### Nested template variables

You can use one template variable to filter tag values for another. The syntax is:

```
tag_values(metric, tagkey, filter1=$var1, filter2=$var2, ...)
```

The following table shows examples of nested template variable queries:

| Query | Description |
| ----- | ----------- |
| `tag_values(cpu, hostname, env=$env)` | Returns hostname values for the cpu metric, filtered by the selected env tag value. |
| `tag_values(cpu, hostname, env=$env, region=$region)` | Returns hostname values for the cpu metric, filtered by both env and region tag values. |

## Annotations

Annotations allow you to overlay event information on graphs. The OpenTSDB data source supports both metric-specific annotations and global annotations.

To configure an annotation query:

1. Click the dashboard settings icon (gear) in the top navigation.
1. Select **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Select the **OpenTSDB** data source.
1. Enter a metric query in the **OpenTSDB metrics query** field (for example, `events.deployment`).
1. Enable **Show Global Annotations** to include annotations that aren't tied to a specific time series.

Annotations appear as vertical lines on your graph panels at the timestamps where events occurred.

## Alerting

The OpenTSDB data source supports Grafana Alerting. You can create alert rules based on OpenTSDB queries to receive notifications when metrics cross thresholds.

For information on creating alert rules, refer to the [Alerting](ref:alerting) documentation.

{{< admonition type="note" >}}
When using OpenTSDB 2.4 with alerting, Grafana executes queries with the parameter `arrays=true`. This causes OpenTSDB to return data points as an array of arrays instead of a map of key-value pairs, which Grafana converts to the appropriate format.
{{< /admonition >}}

## Explore

You can use [Explore](ref:explore) to query OpenTSDB data without creating a dashboard. This is useful for ad-hoc data exploration and troubleshooting.

For details on OpenTSDB metric queries, refer to the official [OpenTSDB documentation](http://opentsdb.net/docs/build/html/index.html).

## Troubleshoot OpenTSDB data source issues

This section provides solutions to common issues you may encounter when configuring or using the OpenTSDB data source.

### Connection errors

These errors occur when Grafana can't connect to the OpenTSDB server.

#### "Connection refused" or timeout errors

**Symptoms:**

- Save & test fails
- Queries return connection errors
- Intermittent timeouts

**Possible causes and solutions:**

| Cause | Solution |
| ----- | -------- |
| Wrong URL or port | Verify the URL includes the correct protocol, IP address, and port. The default port is `4242`. |
| OpenTSDB not running | Check that the OpenTSDB server is running and accessible. |
| Firewall blocking connection | Ensure firewall rules allow outbound connections from Grafana to the OpenTSDB server on the configured port. |
| Network issues | Verify network connectivity between Grafana and OpenTSDB. Try pinging the server or using `curl` to test the API. |

To test connectivity manually, run:

```sh
curl http://<OPENTSDB_HOST>:4242/api/version
```

### Authentication errors

These errors occur when credentials are invalid or misconfigured.

#### "401 Unauthorized" or "403 Forbidden"

**Symptoms:**

- Save & test fails with authentication error
- Queries return authorization errors

**Solutions:**

1. Verify that basic authentication credentials are correct in the data source configuration.
1. Check that the OpenTSDB server is configured to accept the provided credentials.
1. If using cookies for authentication, ensure the required cookies are listed in **Allowed cookies**.

### Query errors

These errors occur when executing queries against OpenTSDB.

#### No data returned

**Symptoms:**

- Query executes without error but returns no data
- Panels show "No data" message

**Possible causes and solutions:**

| Cause | Solution |
| ----- | -------- |
| Time range doesn't contain data | Expand the dashboard time range. Verify data exists in OpenTSDB for the selected period. |
| Wrong metric name | Verify the metric name is correct. Use autocomplete to discover available metrics. |
| Incorrect tag filters | Remove or adjust tag filters. Use `*` as a wildcard to match all values. |
| Version mismatch | Ensure the configured OpenTSDB version matches your server. Filters are only available in version 2.2+. |
| Using both Filters and Tags | Use either Filters or Tags, not both. They're mutually exclusive in OpenTSDB 2.2+. |

#### Query timeout

**Symptoms:**

- Queries take a long time and then fail
- Error message mentions timeout

**Solutions:**

1. Reduce the time range of your query.
1. Add more specific tag filters to reduce the data volume.
1. Increase the **Timeout** setting in the data source configuration.
1. Enable downsampling to reduce the number of data points returned.
1. Check OpenTSDB server performance and HBase health.

### Autocomplete doesn't work

**Symptoms:**

- No suggestions appear when typing metric names, tag names, or tag values
- Drop-down menus are empty

**Solutions:**

1. Verify that the OpenTSDB suggest API is enabled. Check the `tsd.core.auto_create_metrics` setting in your OpenTSDB configuration.
1. Increase the **Lookup limit** setting if you have many metrics or tags.
1. Verify that the data source connection is working by clicking **Save & test**.

### Template variables don't populate

**Symptoms:**

- Template variable drop-down menus are empty
- **Preview of values** shows no results

**Solutions:**

1. Enable real-time metadata tracking in OpenTSDB by setting `tsd.core.meta.enable_realtime_ts` to `true` in your OpenTSDB configuration.
1. Sync existing metadata by running `tsdb uid metasync` on the OpenTSDB server.
1. Verify the variable query syntax is correct. Refer to [Query variable](#query-variable) for the correct syntax.
1. Check that the data source connection is working.

### Performance issues

These issues relate to slow queries or high resource usage.

#### Slow queries

**Symptoms:**

- Dashboards take a long time to load
- Queries are slow even for small time ranges

**Solutions:**

1. Enable downsampling in the query editor to reduce data volume.
1. Use more specific tag filters to limit the time series returned.
1. Reduce the time range.
1. Check OpenTSDB and HBase performance metrics.
1. Consider increasing OpenTSDB heap size if memory is constrained.

#### HBase performance issues

OpenTSDB relies on HBase for data storage. Performance problems in HBase directly affect OpenTSDB query performance.

**Solutions:**

1. Monitor HBase region server health and compaction status.
1. Ensure sufficient heap memory is allocated to HBase region servers.
1. Check for region hotspots and rebalance if necessary.
1. Refer to the [OpenTSDB troubleshooting guide](http://opentsdb.net/docs/build/html/user_guide/troubleshooting.html) for HBase-specific issues.

### Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for OpenTSDB-specific entries that include request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

### Get additional help

If you've tried the solutions in this section and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review [OpenTSDB issues on GitHub](https://github.com/grafana/grafana/issues?q=opentsdb) for known bugs.
1. Consult the [OpenTSDB documentation](http://opentsdb.net/docs/build/html/index.html) for server-specific guidance.
1. Contact Grafana Support if you're a Grafana Enterprise, Cloud Pro, or Cloud Contracted user.

When reporting issues, include:

- Grafana version
- OpenTSDB version
- Error messages (redact sensitive information)
- Steps to reproduce
- Data source configuration (redact credentials)
