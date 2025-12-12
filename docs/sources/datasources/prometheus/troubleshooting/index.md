---
aliases:
  - ../../data-sources/prometheus/troubleshooting/
description: Troubleshooting the Prometheus data source in Grafana
keywords:
  - grafana
  - prometheus
  - troubleshooting
  - errors
  - promql
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot issues with the Prometheus data source
weight: 600
---

# Troubleshoot issues with the Prometheus data source

This document provides troubleshooting information for common errors you may encounter when using the Prometheus data source in Grafana.

## Connection errors

The following errors occur when Grafana cannot establish or maintain a connection to Prometheus.

### Failed to connect to Prometheus

**Error message:** "There was an error returned querying the Prometheus API"

**Cause:** Grafana cannot establish a network connection to the Prometheus server.

**Solution:**

1. Verify that the Prometheus server URL is correct in the data source configuration.
1. Check that Prometheus is running and accessible from the Grafana server.
1. Ensure the URL includes the protocol (`http://` or `https://`).
1. Verify the port is correct (the Prometheus default port is `9090`).
1. Ensure there are no firewall rules blocking the connection.
1. If Grafana and Prometheus are running in separate containers, use the container IP address or hostname instead of `localhost`.
1. For Grafana Cloud, ensure you have configured [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if your Prometheus instance is not publicly accessible.

### Request timed out

**Error message:** "context deadline exceeded" or "request timeout"

**Cause:** The connection to Prometheus timed out before receiving a response.

**Solution:**

1. Check the network latency between Grafana and Prometheus.
1. Verify that Prometheus is not overloaded or experiencing performance issues.
1. Increase the **Query timeout** setting in the data source configuration under **Interval behavior**.
1. Reduce the time range or complexity of your query.
1. Check if any network devices (load balancers, proxies) are timing out the connection.

### Failed to parse data source URL

**Error message:** "Failed to parse data source URL"

**Cause:** The URL entered in the data source configuration is not valid.

**Solution:**

1. Verify the URL format is correct (for example, `http://localhost:9090` or `https://prometheus.example.com:9090`).
1. Ensure the URL includes the protocol (`http://` or `https://`).
1. Remove any trailing slashes or invalid characters from the URL.

## Authentication errors

The following errors occur when there are issues with authentication credentials or permissions.

### Unauthorized (401)

**Error message:** "401 Unauthorized" or "Authorization failed"

**Cause:** The authentication credentials are invalid or missing.

**Solution:**

1. Verify that the username and password are correct if using basic authentication.
1. Check that the authentication method selected matches your Prometheus configuration.
1. If using a reverse proxy with authentication, verify the credentials are correct.
1. For AWS SigV4 authentication, verify the IAM credentials and permissions.

### Forbidden (403)

**Error message:** "403 Forbidden" or "Access denied"

**Cause:** The authenticated user does not have permission to access the requested resource.

**Solution:**

1. Verify the user has read access to the Prometheus API.
1. Check Prometheus security settings and access control configuration.
1. If using a reverse proxy, verify the proxy is not blocking the request.
1. For AWS Managed Prometheus, verify the IAM policy grants the required permissions.

## Query errors

The following errors occur when there are issues with PromQL syntax or query execution.

### Query syntax error

**Error message:** "parse error: unexpected character" or "bad_data: 1:X: parse error"

**Cause:** The PromQL query contains invalid syntax.

**Solution:**

1. Check your query syntax for typos or invalid characters.
1. Verify that metric names and label names are valid identifiers.
1. Ensure string values in label matchers are enclosed in quotes.
1. Use the Prometheus expression browser to test your query directly.
1. Refer to the [Prometheus querying documentation](https://prometheus.io/docs/prometheus/latest/querying/basics/) for syntax guidance.

### Unknown metric name

**Error message:** "unknown metric name" or query returns no data

**Cause:** The specified metric does not exist in Prometheus.

**Solution:**

1. Verify the metric name is spelled correctly.
1. Check that the metric is being scraped by Prometheus.
1. Use the Prometheus UI to browse available metrics at `/graph` or `/api/v1/label/__name__/values`.
1. Verify the time range includes data for the metric.

### Query timeout limit exceeded

**Error message:** "query timed out in expression evaluation" or "query processing would load too many samples"

**Cause:** The query took longer than the configured timeout limit or would return too many samples.

**Solution:**

1. Reduce the time range of your query.
1. Add more specific label filters to limit the data scanned.
1. Increase the **Query timeout** setting in the data source configuration.
1. Use aggregation functions like `sum()`, `avg()`, or `rate()` to reduce the number of time series.
1. Increase the `query.timeout` or `query.max-samples` settings in Prometheus if you have admin access.

### Too many time series

**Error message:** "exceeded maximum resolution of 11,000 points per timeseries" or "maximum number of series limit exceeded"

**Cause:** The query is returning more time series or data points than the configured limits allow.

**Solution:**

1. Reduce the time range of your query.
1. Add label filters to limit the number of time series returned.
1. Increase the **Min interval** or **Resolution** in the query options to reduce the number of data points.
1. Use aggregation functions to combine time series.
1. Adjust the **Series limit** setting in the data source configuration under **Other settings**.

### Invalid function or aggregation

**Error message:** "unknown function" or "parse error: unexpected aggregation"

**Cause:** The query uses an invalid or unsupported PromQL function.

**Solution:**

1. Verify the function name is spelled correctly and is a valid PromQL function.
1. Check that you are using the correct syntax for the function.
1. Ensure your Prometheus version supports the function you are using.
1. Refer to the [PromQL functions documentation](https://prometheus.io/docs/prometheus/latest/querying/functions/) for available functions.

## Configuration errors

The following errors occur when the data source is not configured correctly.

### Invalid Prometheus type

**Error message:** Unexpected behavior when querying metrics or labels

**Cause:** The **Prometheus type** setting does not match your actual Prometheus-compatible database.

**Solution:**

1. Open the data source configuration in Grafana.
1. Under **Performance**, select the correct **Prometheus type** (Prometheus, Cortex, Mimir, or Thanos).
1. Different database types support different APIs, so setting this incorrectly may cause unexpected behavior.

### Scrape interval mismatch

**Error message:** Data appears sparse or aggregated incorrectly

**Cause:** The **Scrape interval** setting in Grafana does not match the actual scrape interval in Prometheus.

**Solution:**

1. Check your Prometheus configuration file for the `scrape_interval` setting.
1. Update the **Scrape interval** in the Grafana data source configuration under **Interval behavior** to match.
1. If the Grafana interval is higher than the Prometheus interval, you may see fewer data points than expected.

## TLS and certificate errors

The following errors occur when there are issues with TLS configuration.

### Certificate verification failed

**Error message:** "x509: certificate signed by unknown authority" or "certificate verify failed"

**Cause:** Grafana cannot verify the TLS certificate presented by Prometheus.

**Solution:**

1. If using a self-signed certificate, enable **Add self-signed certificate** in the TLS settings and add your CA certificate.
1. Verify the certificate chain is complete and valid.
1. Ensure the certificate has not expired.
1. As a temporary workaround for testing, enable **Skip TLS verify** (not recommended for production).

### TLS handshake error

**Error message:** "tls: handshake failure" or "connection reset"

**Cause:** The TLS handshake between Grafana and Prometheus failed.

**Solution:**

1. Verify that Prometheus is configured to use TLS.
1. Check that the TLS version and cipher suites are compatible.
1. If using client certificates, ensure they are correctly configured in the **TLS client authentication** section.
1. Verify the server name matches the certificate's Common Name or Subject Alternative Name.

## Other common issues

The following issues don't produce specific error messages but are commonly encountered.

### Empty query results

**Cause:** The query returns no data.

**Solution:**

1. Verify the time range includes data in Prometheus.
1. Check that the metric and label names are correct.
1. Test the query directly in the Prometheus expression browser.
1. Ensure label filters are not excluding all data.
1. For rate or increase functions, ensure the time range is at least twice the scrape interval.

### Slow query performance

**Cause:** Queries take a long time to execute.

**Solution:**

1. Reduce the time range of your query.
1. Add more specific label filters to limit the data scanned.
1. Increase the **Min interval** in the query options.
1. Check Prometheus server performance and resource utilization.
1. Enable **Disable metrics lookup** in the data source configuration for large Prometheus instances.
1. Enable **Incremental querying (beta)** to cache query results.
1. Consider using recording rules to pre-aggregate frequently queried data.

### Data appears delayed or missing recent points

**Cause:** The visualization doesn't show the most recent data.

**Solution:**

1. Check the dashboard time range and refresh settings.
1. Verify the **Scrape interval** is configured correctly.
1. Ensure Prometheus has finished scraping the target.
1. Check for clock synchronization issues between Grafana and Prometheus.
1. For `rate()` and similar functions, remember that they need at least two data points to calculate.

### Exemplars not showing

**Cause:** Exemplar data is not appearing in visualizations.

**Solution:**

1. Verify that exemplars are enabled in the data source configuration under **Exemplars**.
1. Check that your Prometheus version supports exemplars (2.26+).
1. Ensure your instrumented application is sending exemplar data.
1. Verify the tracing data source is correctly configured for the exemplar link.
1. Enable the **Exemplars** toggle in the query editor.

### Alerting rules not visible

**Cause:** Prometheus alerting rules are not appearing in the Grafana Alerting UI.

**Solution:**

1. Verify that **Manage alerts via Alerting UI** is enabled in the data source configuration.
1. Check that Prometheus has alerting rules configured.
1. Ensure Grafana can access the Prometheus rules API endpoint.
1. Note that for Prometheus (unlike Mimir), the Alerting UI only supports viewing existing rules, not creating new ones.

## Get additional help

If you continue to experience issues after following this troubleshooting guide:

1. Check the [Prometheus documentation](https://prometheus.io/docs/) for API and PromQL guidance.
1. Review the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Contact Grafana Support if you are a Cloud Pro, Cloud Contracted, or Enterprise user.
1. When reporting issues, include:
   - Grafana version
   - Prometheus version and type (Prometheus, Mimir, Cortex, Thanos)
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration such as data source settings, query timeout, and TLS settings (redact tokens, passwords, and other credentials)
