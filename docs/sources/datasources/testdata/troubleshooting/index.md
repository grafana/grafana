---
description: Troubleshoot common issues with the TestData data source in Grafana.
keywords:
  - grafana
  - testdata
  - troubleshooting
  - errors
  - streaming
  - CSV
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot TestData data source issues
weight: 500
review_date: "2026-04-08"
---

# Troubleshoot TestData data source issues

This document provides solutions to common issues you may encounter when using the TestData data source. TestData is a built-in data source with no external dependencies, so most issues relate to scenario configuration or data formatting.

For configuration instructions, refer to [Configure TestData](../configure/).

## Query errors

These errors occur when running TestData scenarios.

### "No data" or empty panels

**Symptoms:**

- Panel displays "No data" message.
- Query executes without error but returns nothing.

**Possible causes and solutions:**

| Cause                                | Solution                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| No Data Points scenario selected     | The No Data Points scenario returns empty results by design. Select a different scenario such as Random Walk.              |
| Datapoints Outside Range selected    | This scenario returns a data point one hour before the query time range. Expand the time range or select a different scenario. |
| Empty String Input for CSV scenarios | CSV Metric Values and CSV Content require input data. Add comma-separated values or CSV content.                          |
| Time range doesn't contain data      | Some scenarios generate data relative to the query time range. Expand the dashboard time range.                           |

### Unexpected error from Conditional Error

**Symptoms:**

- Query returns a server error or panic message.
- Error appears immediately when running the query.

**Solutions:**

1. The Conditional Error scenario triggers a server panic when the **String Input** field is empty. This is the intended behavior for error testing.
1. To return data instead of an error, populate the **String Input** field with comma-separated values (for example, `1,20,90,30,5,0`).
1. To change the error type, use the **Error type** drop-down to select between Server panic, Frontend exception, and Frontend observable.

### Error with source returns an error

The Error with source scenario intentionally returns errors for testing how Grafana handles different error sources. This isn't a misconfiguration.

- **Plugin** error source simulates an error originating from the plugin itself.
- **Downstream** error source simulates an error from a downstream service.

Use this scenario to test alerting rules, error displays, and error handling in custom panels.

### Slow Query appears stuck

**Symptoms:**

- Query runs for an extended period.
- Panel shows a loading spinner indefinitely.

**Solutions:**

1. Check the **String Input** field, which controls the delay duration. The default is `5s`.
1. Reduce the value to a shorter duration (for example, `1s` or `500ms`).
1. The field accepts Go duration syntax: `5s` (seconds), `1m` (minutes), `500ms` (milliseconds).

## CSV and data input errors

These errors occur with scenarios that accept user-provided data.

### CSV Content or CSV Metric Values return unexpected results

**Symptoms:**

- Data doesn't match expectations.
- Fewer data points than expected.
- Parsing errors.

**Solutions:**

1. Verify CSV formatting: headers in the first row, commas as delimiters, numeric values unquoted.
1. For CSV Metric Values, enter only comma-separated numbers in the **String Input** field (for example, `1,20,90,30,5,0`).
1. The special values `null` and `nan` are supported in Predictable CSV Wave values. Use `null` for missing data points and `nan` for Not-a-Number values.
1. Check for trailing commas or extra whitespace in your input.

### Raw Frames JSON parse errors

**Symptoms:**

- Error message about invalid JSON.
- Panel fails to render.

**Solutions:**

1. Validate that the JSON matches the Grafana data frame format.
1. Use the paste helpers in the editor to import data from panel JSON or raw query results.
1. Verify that field types are consistent within each field array.

## Streaming errors

These errors occur with the Streaming Client and Grafana Live scenarios.

### Streaming Client doesn't update

**Symptoms:**

- Panel shows initial data but doesn't update.
- No new data points appear over time.

**Solutions:**

1. Verify the **Speed** field is set to a reasonable value (in milliseconds). Lower values produce faster updates.
1. For the **Fetch** type, verify the URL is accessible from the browser.
1. Check the browser console for WebSocket or network errors.

### Grafana Live channel shows no data

**Symptoms:**

- Panel remains empty after selecting a channel.
- No streaming data appears.

**Solutions:**

1. Confirm the selected channel matches one of the available options: `random-2s-stream`, `random-flakey-stream`, `random-labeled-stream`, or `random-20Hz-stream`.
1. Verify that Grafana Live is enabled in your Grafana instance.
1. Check the Grafana server logs for Live connection errors.

## Template variable errors

These errors occur when using TestData with dashboard template variables.

### Variables return no values

**Symptoms:**

- Variable drop-down is empty.
- No options appear after selecting the TestData data source.

**Solutions:**

1. Verify the query string navigates valid nodes in the metric tree. Use `*` to return all top-level nodes.
1. Check that dot-separated path segments match the tree structure (for example, `A.*` returns children of node A).
1. Verify the TestData data source connection is working in data source settings.

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for entries containing `testdata` or `testdatasource` for scenario-specific details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried the solutions in this document and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review [Grafana GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. When reporting issues, include:
   - Grafana version
   - Selected scenario and its configuration
   - Error messages (redact sensitive information)
   - Steps to reproduce
