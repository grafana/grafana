---
description: Troubleshoot common issues with the Graphite data source.
keywords:
  - grafana
  - graphite
  - troubleshooting
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot Graphite data source issues
weight: 400
refs:
  configure-graphite:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/graphite/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/graphite/configure/
  query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/graphite/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/graphite/query-editor/
---

# Troubleshoot Graphite data source issues

This document provides solutions for common issues you might encounter when using the Graphite data source.

## Connection issues

Use the following troubleshooting steps to resolve connection problems between Grafana and your Graphite server.

**Data source test fails with "Unable to connect":**

If the data source test fails, verify the following:

- The URL in your data source configuration is correct and accessible from the Grafana server.
- The Graphite server is running and accepting connections.
- Any firewalls or network policies allow traffic between Grafana and the Graphite server.
- If using TLS, ensure your certificates are valid and properly configured.

To test connectivity, run the following command from the Grafana server:

```sh
curl -v <GRAPHITE_URL>/render
```

Replace _`<GRAPHITE_URL>`_ with your Graphite server URL. A successful connection returns a response from the Graphite server.

**Authentication errors:**

If you receive 401 or 403 errors:

- Verify your Basic Auth username and password are correct.
- Ensure the **With Credentials** toggle is enabled if your Graphite server requires cookies for authentication.
- Check that your TLS client certificates are valid and match what the server expects.

For detailed authentication configuration, refer to [Configure the Graphite data source](ref:configure-graphite).

## Query issues

Use the following troubleshooting steps to resolve problems with Graphite queries.

**No data returned:**

If your query returns no data:

- Verify the metric path exists in your Graphite server by testing directly in the Graphite web interface.
- Check that the time range in Grafana matches when data was collected.
- Ensure wildcards in your query match existing metrics.
- Confirm your query syntax is correct for your Graphite version.

**HTTP 500 errors with HTML content:**

Graphite-web versions before 1.6 return HTTP 500 errors with full HTML stack traces when a query fails. If you see error messages containing HTML tags:

- Check the Graphite server logs for the full error details.
- Verify your query syntax is valid.
- Ensure the requested time range doesn't exceed your Graphite server's capabilities.
- Check that all functions used in your query are supported by your Graphite version.

**Parser errors in the query editor:**

If the query editor displays parser errors:

- Check for unbalanced parentheses in function calls.
- Verify that function arguments are in the correct format.
- Ensure metric paths don't contain unsupported characters.

For query syntax help, refer to [Graphite query editor](ref:query-editor).

## Version and feature issues

Use the following troubleshooting steps to resolve problems related to Graphite versions and features.

**Functions missing from the query editor:**

If expected functions don't appear in the query editor:

- Verify the correct Graphite version is selected in the data source configuration.
- The available functions depend on the configured version. For example, tag-based functions require Graphite 1.1 or later.
- If using a custom Graphite installation with additional functions, ensure the version setting matches your server.

**Tag-based queries not working:**

If `seriesByTag()` or other tag functions fail:

- Confirm your Graphite server is version 1.1 or later.
- Verify the Graphite version setting in your data source configuration matches your actual server version.
- Check that tags are properly configured in your Graphite server.

## Performance issues

Use the following troubleshooting steps to address slow queries or timeouts.

**Queries timing out:**

If queries consistently time out:

- Increase the **Timeout** setting in the data source configuration.
- Reduce the time range of your query.
- Use more specific metric paths instead of broad wildcards.
- Consider using `summarize()` or `consolidateBy()` functions to reduce the amount of data returned.
- Check your Graphite server's performance and resource utilization.

**Slow autocomplete in the query editor:**

If metric path autocomplete is slow:

- This often indicates a large number of metrics in your Graphite server.
- Use more specific path prefixes to narrow the search scope.
- Check your Graphite server's index performance.

## MetricTank-specific issues

If you're using MetricTank as your Graphite backend, use the following troubleshooting steps.

**Rollup indicator not appearing:**

If the rollup indicator doesn't display when expected:

- Verify **Metrictank** is selected as the Graphite backend type in the data source configuration.
- Ensure the **Rollup indicator** toggle is enabled.
- The indicator only appears when data aggregation actually occurs.

**Unexpected data aggregation:**

If you see unexpected aggregation in your data:

- Check the rollup configuration in your MetricTank instance.
- Adjust the time range or use `consolidateBy()` to control aggregation behavior.
- Review the query processing metadata in the panel inspector for details on how data was processed.

## Get additional help

If you continue to experience issues:

- Check the [Grafana community forums](https://community.grafana.com/) for similar issues and solutions.
- Review the [Graphite documentation](https://graphite.readthedocs.io/) for additional configuration options.
- Contact [Grafana Support](https://grafana.com/support/) if you're an Enterprise, Cloud Pro, or Cloud Advanced customer.

When reporting issues, include the following information:

- Grafana version
- Graphite version (for example, 1.1.x) and backend type (Default or MetricTank)
- Authentication method (Basic Auth, TLS, or none)
- Error messages (redact sensitive information)
- Steps to reproduce the issue
- Relevant configuration such as data source settings, timeout values, and Graphite version setting (redact passwords and other credentials)
- Sample query (if applicable, with sensitive data redacted)
