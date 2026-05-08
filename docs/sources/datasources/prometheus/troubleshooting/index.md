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
title: Troubleshoot Prometheus data source issues
weight: 600
review_date: 2026-05-07
---

# Troubleshoot Prometheus data source issues

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
1. Check the [Grafana server timeout configuration](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana#timeout) for server-level timeout settings.
1. Reduce the time range or complexity of your query.
1. Check if any network devices (load balancers, proxies) are timing out the connection.

### Failed to parse data source URL

**Error message:** "Failed to parse data source URL"

**Cause:** The URL entered in the data source configuration is not valid.

**Solution:**

1. Verify the URL format is correct (for example, `http://localhost:9090` or `https://prometheus.example.com:9090`).
1. Ensure the URL includes the protocol (`http://` or `https://`).
1. Remove any trailing slashes or invalid characters from the URL.

### Data doesn't appear in Metrics Drilldown or Explore

**Symptom:** You've successfully tested the data source connection, but no metric data appears in Explore or Metrics Drilldown.

**Cause:** The wrong data source is selected, or the data source name doesn't match expectations.

**Solution:**

1. Verify you've selected the correct data source from the data source drop-down menu.
1. When using `remote_write` to send metrics to Grafana Cloud, the data source name follows the convention `grafanacloud-<stackname>-prom`.
1. Check that metrics are being actively scraped by querying `up` in the Explore view.
1. If using Grafana Cloud, verify the `remote_write` endpoint URL and credentials are correct.

### PDC connectivity errors

**Error messages:** "host unreachable", "EOF", "network unreachable", "connection reset by peer", "dial tcp: lookup ... no such host"

**Symptom:** Prometheus queries fail intermittently or consistently when using Private data source connect (PDC) to reach a Prometheus instance behind a private network. The data source test may pass occasionally but queries fail under load.

**Cause:** PDC tunnels traffic through an SSH connection between Grafana Cloud and your PDC agent. Connectivity failures are most commonly caused by DNS resolution issues, network configuration on the customer side, or the PDC agent's default connection limits being too low for the query volume.

**Solutions:**

1. **Verify DNS resolution from the PDC agent host.** The PDC agent must be able to resolve the Prometheus hostname from the machine it runs on. Run `nslookup` or `dig` for the Prometheus URL from the agent host to confirm.
1. **Check network connectivity from the agent.** Ensure the PDC agent can reach the Prometheus endpoint directly (for example, `curl http://prometheus-host:9090/-/healthy` from the agent machine).
1. **Increase parallel SSH connections.** The PDC agent defaults to 1 parallel SSH connection, which can bottleneck under load from multiple alert evaluations or dashboard queries. Increase this by setting the `--ssh-connections` flag (or `PDC_SSH_CONNECTIONS` environment variable) to a higher value (for example, 4 or 8):

   ```sh
   pdc-agent --ssh-connections=4
   ```

1. **Check firewall rules.** Ensure the PDC agent's outbound SSH connection to Grafana Cloud isn't being interrupted by firewalls, NAT gateways, or idle connection timeouts.
1. **Verify the PDC agent is running and healthy.** Check agent logs for connection errors or restarts. The agent must maintain a persistent connection to Grafana Cloud.
1. **Check for idle timeout issues.** If the connection drops after periods of inactivity, configure TCP keepalives on the host or add a keepalive setting to the PDC agent configuration.

{{< admonition type="note" >}}
PDC connectivity issues are almost always caused by networking on the customer side (DNS, firewalls, routing), not by Grafana Cloud. The data source test passing doesn't guarantee sustained connectivity under load — it only verifies a single query succeeds.
{{< /admonition >}}

For general PDC setup and configuration, refer to [Private data source connect (PDC)](/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) and [Configure PDC](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/).

## Authentication errors

The following errors occur when there are issues with authentication credentials or permissions.

### Unauthorized (401)

**Error message:** "401 Unauthorized" or "Authorization failed"

**Cause:** The authentication credentials are invalid or missing.

**Solution:**

1. Verify that the username and password are correct if using basic authentication.
1. Check that the authentication method selected matches your Prometheus configuration.
1. If using a reverse proxy with authentication, verify the credentials are correct.
1. For AWS SigV4 authentication, verify the IAM credentials and permissions. Alternatively, consider using the [Amazon Managed Service for Prometheus data source](https://grafana.com/grafana/plugins/grafana-amazonprometheus-datasource/) for simplified AWS authentication.

### OAuth token expiration errors (GCP and Azure)

**Error messages:** "ACCESS_TOKEN_EXPIRED", "401 Unauthorized" in alerting but not in Explore

**Symptom:** Queries in Explore and dashboards work correctly, but alert rule evaluations fail intermittently with 401 errors. This is most common with Google Managed Prometheus (GMP) and Azure-managed Prometheus endpoints using OAuth/OIDC authentication.

**Cause:** Grafana's alerting backend and the interactive query path (Explore, dashboards) handle credential refreshes differently. The alerting evaluator can use a cached OAuth token beyond its expiry window due to a token staleness check issue in the Prometheus data source. This causes alerting to fail with expired credentials while interactive queries succeed because they trigger a fresh token exchange.

**Solutions:**

For Google Managed Prometheus (GMP):

1. Use the **GCP datasource-syncer** pattern: run a sidecar process that refreshes OAuth tokens and updates the Grafana data source credentials on a schedule shorter than the token lifetime (typically every 45 minutes for a 60-minute token). This ensures the stored token is always valid when the alerting backend uses it.
1. Alternatively, use the [Google Cloud Monitor data source](https://grafana.com/grafana/plugins/stackdriver/) with its built-in GCP credential management rather than pointing the core Prometheus data source at a GMP endpoint.
1. If running on GKE with Workload Identity, ensure the Kubernetes service account token refresh is functioning and the projected token volume is mounted correctly.

For Azure Managed Prometheus:

1. Verify the Azure AD app registration's client secret hasn't expired.
1. If using Managed Identity, ensure the Grafana instance's identity has the **Monitoring Data Reader** role on the Azure Monitor workspace.
1. Check that **Forward OAuth identity** is not enabled alongside Azure AD authentication — both use the same HTTP authorization headers and conflict with each other.

General steps:

1. Check the Grafana server logs for token refresh errors around the time alerts fail.
1. Verify the data source test (**Save & test**) passes — this confirms current credentials are valid but doesn't guarantee the alerting backend has a fresh token.
1. If the issue persists, set **Alert state if execution error or timeout** to **Keep Last State** to prevent false alarms while investigating. Refer to [Configure alert state for execution errors](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/alerting/#configure-alert-state-for-execution-errors).

{{< admonition type="note" >}}
This token caching behavior is a known issue that has received code fixes in recent Grafana releases. If you're experiencing this on an older Grafana version, upgrading may resolve it. Check the [Grafana changelog](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/whatsnew/) for relevant fixes.
{{< /admonition >}}

### LBAC not restricting data on non-Mimir backends

**Symptom:** You've enabled `teamHttpHeadersMimir` and configured Team LBAC rules, but users can still see all metrics regardless of their team assignments.

**Cause:** Label-Based Access Control (LBAC) for the Prometheus data source only works when the backend is **Grafana Cloud Metrics (Mimir)** or **Grafana Enterprise Metrics (GEM)**. It doesn't work with Google Managed Prometheus, self-hosted Prometheus, Thanos, or other Prometheus-compatible endpoints. The LBAC enforcement relies on Mimir-specific HTTP headers (`X-Scope-OrgID` and team-scoped label matchers) that other backends ignore.

**Solution:**

1. Verify your backend is Grafana Cloud Metrics or GEM. If you're using a different Prometheus-compatible backend, LBAC isn't supported.
1. For Google Managed Prometheus or other external endpoints, use Grafana's [data source permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#data-source-permissions) to control which teams can access the data source entirely, rather than per-label access control.
1. If you need per-label restrictions on a non-Mimir backend, consider proxying through a Mimir instance or using a separate data source per team with different credentials scoped to the appropriate data.

### Azure AD or SigV4 authentication options not available

**Symptom:** The Azure AD or SigV4 authentication options don't appear in the authentication drop-down when configuring the Prometheus data source.

**Cause:** These authentication methods require server-side feature flags that aren't enabled by default, particularly on Grafana Cloud.

**Solution:**

1. **Grafana Cloud:** Contact [Grafana Support](https://grafana.com/profile/org#support) to request the feature flag be enabled for your stack. This isn't a self-service setting.
1. **Self-managed Grafana:** Add the required setting to your Grafana configuration file:
   - For Azure AD: set `azure_auth_enabled = true` under `[auth]`
   - For SigV4: set `sigv4_auth_enabled = true` under `[auth]`
1. **For Amazon Managed Prometheus:** Consider using the dedicated [Amazon Managed Service for Prometheus data source](https://grafana.com/grafana/plugins/grafana-amazonprometheus-datasource/) instead, which handles AWS authentication natively without needing the SigV4 flag.

### Forbidden (403)

**Error message:** "403 Forbidden" or "Access denied"

**Cause:** The authenticated user does not have permission to access the requested resource.

**Solution:**

1. Verify the user has read access to the Prometheus API.
1. Check Prometheus security settings and access control configuration.
1. If using a reverse proxy, verify the proxy is not blocking the request.
1. For AWS Managed Prometheus, verify the IAM policy grants the required permissions. Alternatively, consider using the [Amazon Managed Service for Prometheus data source](https://grafana.com/grafana/plugins/grafana-amazonprometheus-datasource/) for simplified AWS authentication.

## Query errors

The following errors occur when there are issues with PromQL syntax or query execution.

### Query syntax error

**Error message:** "parse error: unexpected character" or "bad_data: 1:X: parse error"

**Cause:** The PromQL query contains invalid syntax.

**Alternative cause:** A proxy between Grafana and Prometheus requires authentication. When proxy authentication fails, the proxy redirects the request to an HTML authentication page. Grafana cannot parse the HTML response, which results in a parse error. This appears to be a query issue but is actually a proxy authentication issue.

**Solution:**

1. Check your query syntax for typos or invalid characters.
1. Verify that metric names and label names are valid identifiers.
1. Ensure string values in label matchers are enclosed in quotes.
1. Use the Prometheus expression browser to test your query directly.
1. Refer to the [Prometheus querying documentation](https://prometheus.io/docs/prometheus/latest/querying/basics/) for syntax guidance.
1. If you have a proxy between Grafana and Prometheus, verify that proxy authentication is correctly configured. Check your proxy logs for authentication failures or redirects.

### Query returns no data for a metric

**Symptom:** The query returns no data and the visualization is empty.

**Cause:** The specified metric does not exist in Prometheus, or there is no data for the selected time range.

**Solution:**

1. Verify the metric name is spelled correctly.
1. Check that the metric is being scraped by Prometheus.
1. Use the Prometheus API to browse available metrics at `/api/v1/label/__name__/values`.
1. Use the [target metadata API](https://prometheus.io/docs/prometheus/latest/querying/api#querying-target-metadata) to verify which metrics a target exposes.
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

### Memory limit exceeded for high-cardinality queries

**Error messages:** "max-estimated-memory-consumption-per-query limit exceeded", "query requires too much memory", "max samples limit reached"

**Symptom:** Queries against high-cardinality metrics (thousands of unique label combinations) over long time ranges (days or weeks) fail with memory or sample limit errors. Short time ranges may work but expanding the range causes the failure.

**Cause:** Prometheus and Mimir enforce per-query memory and sample limits to protect the system from resource exhaustion. High-cardinality metrics (for example, metrics with a `pod`, `request_id`, or `user_id` label) multiplied by long time ranges produce result sets that exceed these limits.

**Solutions:**

1. **Reduce the query scope:**
   - Shorten the time range.
   - Add label matchers to select fewer series (for example, filter to a specific `namespace` or `job`).
   - Increase the **Min step** or use a larger step interval to reduce the number of data points per series.

1. **Use recording rules to pre-aggregate:**
   Create [recording rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/) that pre-compute the aggregation you need. For example, if you commonly query `sum(rate(http_requests_total[5m])) by (service)`, create a recording rule for it and query the pre-aggregated metric instead.

   ```yaml
   groups:
     - name: aggregations
       rules:
         - record: service:http_requests_total:rate5m
           expr: sum(rate(http_requests_total[5m])) by (service)
   ```

1. **Use Adaptive Metrics (Grafana Cloud):**
   If you're on Grafana Cloud, [Adaptive Metrics](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/reduce-costs/metrics-costs/control-metrics-usage-via-adaptive-metrics/) automatically identifies and aggregates high-cardinality metrics that aren't being queried at full resolution, reducing storage and query costs.

1. **Restructure dashboards for high-cardinality data:**
   - Use template variables to scope queries to a subset of labels rather than querying all series at once.
   - Split long-range overviews (weekly/monthly) into separate panels that use pre-aggregated recording rules.
   - Use the **Max data points** setting in the query options to cap the resolution for overview panels.

1. **Increase limits (self-managed only):**
   If you have admin access to Prometheus or Mimir, you can increase limits in the server configuration:
   - Prometheus: `--query.max-samples` flag
   - Mimir: `-querier.max-samples`, `-querier.max-estimated-memory-consumption-per-query`

   {{< admonition type="note" >}}
   Increasing limits allows larger queries to succeed but also increases the risk of resource exhaustion. Prefer reducing query scope or using recording rules over raising limits.
   {{< /admonition >}}

### Invalid function or aggregation

**Error message:** "unknown function" or "parse error: unexpected aggregation"

**Cause:** The query uses an invalid or unsupported PromQL function.

**Solution:**

1. Verify the function name is spelled correctly and is a valid PromQL function.
1. Check that you are using the correct syntax for the function.
1. Ensure your Prometheus version supports the function you are using.
1. Refer to the [PromQL functions documentation](https://prometheus.io/docs/prometheus/latest/querying/functions/) for available functions.

### `rate()` or `increase()` returning unexpected values

**Symptom:** `increase()` returns fractional values on integer counters, `rate()` shows an ever-increasing value instead of a steady per-second rate, or counter resets cause large spikes in visualizations.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| `increase()` fractional values | Expected behavior — Prometheus uses linear interpolation. Use `ceil()` or `floor()` if you need integers. |
| `rate()` grows over time | Multiple instances write to the same series without unique labels. Ensure each target has unique `instance`/`pod` labels and aggregate with `sum by`. |
| Counter reset spikes after pod restarts | Use `$__rate_interval` or a longer range vector to smooth spikes. Investigate frequent restarts as the root cause. |
| Values differ between edit mode and dashboard | Panel width affects `$__interval` which affects `rate()` window calculations. Set a **Min step** on the query. |

For detailed explanations of these behaviors, refer to [Common PromQL gotchas](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/query-editor/#common-promql-gotchas).

### Aggregation by labels with dots

**Symptom:** Queries that aggregate by label names containing dots (for example, `container.name`) return incorrect or incomplete results.

**Cause:** Prior to Grafana 13, there was a bug where labels with dots in their names were not handled correctly during aggregation operations like `sum by` or `avg by`.

**Solution:**

1. Upgrade to Grafana 13 or later, which correctly handles labels with dots in aggregation queries.
1. Verify your query uses the correct label name with dots (for example, `sum by (container.name) (metric_name)`).

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

**Symptom:** Data appears sparse, or `rate()` queries return no data or incomplete results.

**Cause:** The **Scrape interval** setting in Grafana does not match the actual scrape interval in Prometheus. This especially affects `rate()` queries, which require at least two data points within the specified time window. For example, if your actual scrape interval is 5 minutes but Grafana uses the default (15 seconds for OSS, 1 minute for Grafana Cloud), a query like `rate(http_requests_total[1m])` returns no data because there are no data points within that 1-minute window.

**Solution:**

1. Check your Prometheus configuration file for the `scrape_interval` setting.
1. Update the **Scrape interval** in the Grafana data source configuration under **Interval behavior** to match.
1. Use `$__rate_interval` instead of hardcoded time windows in `rate()` queries. This variable automatically adjusts based on your scrape interval.
1. For more information, refer to [$\_\_rate_interval for Prometheus rate queries that just work](https://grafana.com/blog/2020/09/28/new-in-grafana-7.2-__rate_interval-for-prometheus-rate-queries-that-just-work/).

### `$__rate_interval` returns no data or incorrect values

**Symptom:** Queries using `$__rate_interval` return no data, return different values in edit mode versus the dashboard, or produce unexpected gaps.

**Cause:** `$__rate_interval` is calculated as `max($__interval + scrape_interval, 4 * scrape_interval)`. If any input to this formula is incorrect, the resulting window is wrong — either too small (no data) or inconsistent across contexts.

**Common causes and solutions:**

| Cause | Solution |
|-------|----------|
| Data source scrape interval left at default `15s` while actual Prometheus scrape interval is longer (for example, `60s`) | Set the **Scrape interval** under **Interval behavior** in the data source configuration to match your Prometheus `scrape_interval`. |
| Query works in edit mode but shows gaps on the dashboard | Panel size affects `$__interval`. Smaller panels produce larger intervals. Set a **Min step** on the query to enforce a consistent floor. |
| LBAC-enabled data source doesn't inherit scrape interval | Set the **Min step** explicitly on each query panel rather than relying on data source inheritance. |
| Using `$__rate_interval` in recording rules or alerting | Use a fixed interval (for example, `[5m]`) instead of `$__rate_interval` in contexts without a panel/dashboard. |

**To debug the current value:**

1. Open the query inspector in a panel (click the panel title, then **Inspect** > **Query**).
1. Look at the expanded query sent to Prometheus — the actual interval value replacing `$__rate_interval` is visible in the request.
1. Compare this value against your actual scrape interval. If it's smaller than your scrape interval, you need to configure the data source scrape interval or set a Min step.

For detailed documentation on how `$__rate_interval` works and how to configure it, refer to [Use `$__rate_interval`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/template-variables/#use-__rate_interval).

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

**Error message:** "TLS: handshake failure" or "connection reset"

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

## Annotation errors

The following issues occur when using Prometheus as a data source for annotations.

### Annotations not appearing

**Symptom:** You've configured a Prometheus annotation query, but no annotations appear on your dashboard.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| Query returns no data | Verify the query returns results in Explore for the current time range. |
| All values are zero | Annotations are only created for non-zero data points. Adjust your query to return non-zero values for events. |
| Wrong data source selected | Verify the correct Prometheus data source is selected in the annotation configuration. |
| Time range mismatch | Expand the dashboard time range to include the events you expect to see. |

For more information on configuring annotations, refer to [Prometheus annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/annotations/).

## Alerting errors

The following issues occur when using Prometheus with Grafana Alerting.

### Transient alert errors triggering false alarms

**Error messages:** `sse.dependencyError`, `sse.dataQueryError`, "context deadline exceeded", "i/o timeout"

**Symptom:** Alert rules intermittently fire due to execution errors rather than genuine threshold breaches. On-call teams receive false positive notifications. Alert state history shows error states caused by transient backend issues (network blips, HTTP 502/500 responses, timeouts) rather than actual metric conditions being met.

**Cause:** By default, when an alert rule encounters an execution error or timeout, Grafana sets the alert state to **Alerting** — which fires the alert. Transient connectivity issues between Grafana and Prometheus (i/o timeouts, deadline exceeded, brief outages) trigger this behavior even though the underlying metric hasn't crossed its threshold.

**Solution:**

1. Open each affected alert rule for editing.
1. In the alert conditions section, change **Alert state if execution error or timeout** from **Alerting** to **Keep Last State**.
1. Save the rule.

This ensures the alert retains its previous state during transient errors and only fires when a successful evaluation confirms the threshold is breached.

**If errors are frequent**, also investigate:

1. Network stability between Grafana and Prometheus.
1. Prometheus resource utilization (CPU, memory, disk I/O).
1. The **Query timeout** setting in the data source configuration — increase it if complex queries regularly exceed the limit.
1. Query complexity — simplify queries or use recording rules to pre-compute expensive expressions.

For configuration details, refer to [Configure alert state for execution errors](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/alerting/#configure-alert-state-for-execution-errors).

### Alert rule fails to evaluate

**Symptom:** An alert rule using a Prometheus query shows evaluation errors or remains in a "No Data" state.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| Template variables in query | Alert queries don't support template variables. Replace variables with hard-coded values. |
| Query timeout | Simplify the query or increase the evaluation timeout. Use recording rules for complex expressions. |
| Data source unreachable | Verify the Prometheus data source connection is working (test it in the data source settings). |
| No data in range | Ensure the metric has recent data. Check that Prometheus is actively scraping the target. |

### Data source-managed rules not visible

**Symptom:** Prometheus alerting rules don't appear in the Grafana Alerting UI.

**Solution:**

1. Verify that **Manage alerts via Alerting UI** is enabled in the data source configuration.
1. Check that Prometheus has alerting rules configured in its rule files.
1. Ensure Grafana can access the Prometheus rules API endpoint (`/api/v1/rules`).
1. For Prometheus (unlike Mimir), the Alerting UI only supports viewing existing rules, not creating new ones.

For more information on alerting with Prometheus, refer to [Prometheus alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/alerting/).

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
