---
description: Troubleshoot OpenTSDB data source issues in Grafana
keywords:
  - grafana
  - opentsdb
  - troubleshooting
  - errors
  - connection
  - query
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot OpenTSDB data source issues
weight: 500
last_reviewed: 2026-01-28
refs:
  configure-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/configure/
  template-variables-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/
---

# Troubleshoot OpenTSDB data source issues

This document provides solutions to common issues you may encounter when configuring or using the OpenTSDB data source. For configuration instructions, refer to [Configure the OpenTSDB data source](ref:configure-opentsdb).

## Connection errors

These errors occur when Grafana can't connect to the OpenTSDB server.

### "Connection refused" or timeout errors

**Symptoms:**

- Save & test fails
- Queries return connection errors
- Intermittent timeouts

**Possible causes and solutions:**

| Cause                        | Solution                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Wrong URL or port            | Verify the URL includes the correct protocol, IP address, and port. The default port is `4242`.                   |
| OpenTSDB not running         | Check that the OpenTSDB server is running and accessible.                                                         |
| Firewall blocking connection | Ensure firewall rules allow outbound connections from Grafana to the OpenTSDB server on the configured port.      |
| Network issues               | Verify network connectivity between Grafana and OpenTSDB. Try pinging the server or using `curl` to test the API. |

To test connectivity manually, run:

```sh
curl http://<OPENTSDB_HOST>:4242/api/version
```

## Authentication errors

These errors occur when credentials are invalid or misconfigured.

### "401 Unauthorized" or "403 Forbidden"

**Symptoms:**

- Save & test fails with authentication error
- Queries return authorization errors

**Solutions:**

1. Verify that basic authentication credentials are correct in the data source configuration.
1. Check that the OpenTSDB server is configured to accept the provided credentials.
1. If using cookies for authentication, ensure the required cookies are listed in **Allowed cookies**.

## Query errors

These errors occur when executing queries against OpenTSDB.

### No data returned

**Symptoms:**

- Query executes without error but returns no data
- Panels show "No data" message

**Possible causes and solutions:**

| Cause                           | Solution                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Time range doesn't contain data | Expand the dashboard time range. Verify data exists in OpenTSDB for the selected period.                |
| Wrong metric name               | Verify the metric name is correct. Use autocomplete to discover available metrics.                      |
| Incorrect tag filters           | Remove or adjust tag filters. Use `*` as a wildcard to match all values.                                |
| Version mismatch                | Ensure the configured OpenTSDB version matches your server. Filters are only available in version 2.2+. |
| Using both Filters and Tags     | Use either Filters or Tags, not both. They're mutually exclusive in OpenTSDB 2.2+.                      |

### Query timeout

**Symptoms:**

- Queries take a long time and then fail
- Error message mentions timeout

**Solutions:**

1. Reduce the time range of your query.
1. Add more specific tag filters to reduce the data volume.
1. Increase the **Timeout** setting in the data source configuration.
1. Enable downsampling to reduce the number of data points returned.
1. Check OpenTSDB server performance and HBase health.

## Autocomplete doesn't work

**Symptoms:**

- No suggestions appear when typing metric names, tag names, or tag values
- Drop-down menus are empty

**Solutions:**

1. Verify that the OpenTSDB `/api/suggest` endpoint is accessible. Test it manually with `curl http://<OPENTSDB_HOST>:4242/api/suggest?type=metrics`.
1. Increase the **Lookup limit** setting if you have many metrics or tags.
1. Verify that the data source connection is working by clicking **Save & test**.
1. Check that metrics exist in OpenTSDB. The suggest API only returns metrics that have been written to the database.

## Template variables don't populate

**Symptoms:**

- Template variable drop-down menus are empty
- **Preview of values** shows no results

**Solutions:**

1. Enable real-time metadata tracking in OpenTSDB by setting `tsd.core.meta.enable_realtime_ts` to `true` in your OpenTSDB configuration.
1. Sync existing metadata by running `tsdb uid metasync` on the OpenTSDB server.
1. Verify the variable query syntax is correct. Refer to [Template variables](ref:template-variables-opentsdb) for the correct syntax.
1. Check that the data source connection is working.

## Performance issues

These issues relate to slow queries or high resource usage.

### Slow queries

**Symptoms:**

- Dashboards take a long time to load
- Queries are slow even for small time ranges

**Solutions:**

1. Enable downsampling in the query editor to reduce data volume.
1. Use more specific tag filters to limit the time series returned.
1. Reduce the time range.
1. Check OpenTSDB and HBase performance metrics.
1. Consider increasing OpenTSDB heap size if memory is constrained.

### HBase performance issues

OpenTSDB relies on HBase for data storage. Performance problems in HBase directly affect OpenTSDB query performance.

**Solutions:**

1. Monitor HBase region server health and compaction status.
1. Ensure sufficient heap memory is allocated to HBase region servers.
1. Check for region hotspots and rebalance if necessary.
1. Refer to the [OpenTSDB troubleshooting guide](http://opentsdb.net/docs/build/html/user_guide/troubleshooting.html) for HBase-specific issues.

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for OpenTSDB-specific entries that include request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried the solutions in this document and still encounter issues:

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
