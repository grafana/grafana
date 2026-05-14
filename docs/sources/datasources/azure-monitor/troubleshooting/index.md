---
aliases:
  - ../../data-sources/azure-monitor/troubleshooting/
description: Troubleshooting guide for the Azure Monitor data source in Grafana
keywords:
  - grafana
  - azure
  - monitor
  - troubleshooting
  - errors
  - authentication
  - query
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot Azure Monitor data source issues
weight: 500
review_date: 2026-05-12
---

# Troubleshoot Azure Monitor data source issues

This document provides solutions to common issues you may encounter when configuring or using the Azure Monitor data source, organized by the stage where the issue occurs.

## Connection and network errors

These errors indicate Grafana can't reach Azure endpoints. Verify connectivity before investigating authentication or query issues.

### "Connection refused" or timeout errors

**Symptoms:**

- Data source test fails with network errors
- Queries timeout without returning results

**Solutions:**

1. Verify network connectivity from Grafana to Azure endpoints.
1. Check firewall rules allow outbound HTTPS (port 443) to Azure services.
1. For private networks, ensure Private Link or VPN is configured correctly.
1. For Grafana Cloud, configure [Private Data Source Connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if accessing private resources.

### SSL/TLS certificate errors

**Symptoms:**

- Certificate validation failures
- SSL handshake errors

**Solutions:**

1. Ensure the system time is correct (certificate validation fails with incorrect time).
1. Verify corporate proxy isn't intercepting HTTPS traffic.
1. Check that required CA certificates are installed on the Grafana server.

## Authentication errors

These errors occur when credentials configured in the data source or in Azure are invalid, expired, or missing permissions.

### "Authorization failed" or "Access denied"

**Symptoms:**

- Save & test fails with "Authorization failed"
- Queries return "Access denied" errors
- Subscriptions don't load when clicking **Load Subscriptions**

**Possible causes and solutions:**

| Cause                                              | Solution                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App registration doesn't have required permissions | Assign the `Reader` role to the app registration on the subscription or resource group you want to monitor. Refer to the [Azure documentation for role assignments](https://docs.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal?tabs=current). |
| Incorrect tenant ID, client ID, or client secret   | Verify the credentials in the Azure Portal under **App registrations** > your app > **Overview** (for IDs) and **Certificates & secrets** (for secret).                                                                                                                     |
| Client secret has expired                          | Create a new client secret in Azure and update the data source configuration.                                                                                                                                                                                               |
| Managed Identity not enabled on the Azure resource | For VMs, enable managed identity in the Azure Portal under **Identity**. For App Service, enable it under **Identity** in the app settings.                                                                                                                                 |
| Managed Identity not assigned the Reader role      | Assign the `Reader` role to the managed identity on the target subscription or resources.                                                                                                                                                                                   |

### "Invalid client secret" or "Client secret not found"

**Symptoms:**

- Authentication fails immediately after configuration
- Error message references invalid credentials

**Solutions:**

1. Ensure you copied the client secret **value**, not the secret ID. In Azure Portal under **Certificates & secrets**, the secret value is only shown once when created. The secret ID is a different identifier and won't work for authentication.
1. Verify the client secret was copied correctly (no extra spaces or truncation).
1. Check if the secret has expired in Azure Portal under **App registrations** > your app > **Certificates & secrets**.
1. Create a new secret and update the data source configuration.

### "Tenant not found" or "Invalid tenant ID"

**Symptoms:**

- Data source test fails with tenant-related errors
- Unable to authenticate

**Solutions:**

1. Verify the Directory (tenant) ID in Azure Portal under **Microsoft Entra ID** > **Overview**.
1. Ensure you're using the correct Azure cloud setting (Azure, Azure Government, or Azure China).
1. Check that the tenant ID is a valid GUID format.

### Client certificate authentication not working

**Symptoms:**

- Authentication fails when using App Registration with client certificate
- Error references invalid certificate or signature validation failure

**Possible causes and solutions:**

| Cause                                        | Solution                                                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Certificate has expired                      | Check the certificate expiration date in Azure Portal under **App registrations** > your app > **Certificates & secrets**. Upload a new certificate if expired.  |
| Wrong certificate format                     | Verify you're using the correct format (PEM or PFX) and that the content matches what you selected. PEM requires separate certificate and private key fields.     |
| PFX password is incorrect                    | For encrypted PFX certificates, verify the password is correct.                                                                                                   |
| Private key doesn't match the certificate    | Ensure the private key corresponds to the certificate uploaded to Azure. Regenerate the certificate and key pair if needed.                                       |
| Certificate not uploaded to Azure             | Verify the public certificate is uploaded to the app registration under **Certificates & secrets** > **Certificates** in the Azure Portal.                       |

## Grafana server configuration errors

These errors occur when the Grafana server `.ini` configuration is missing settings required by Managed Identity, Workload Identity, or Current User authentication. If your Azure credentials are correct but authentication still fails, check this section.

### Managed Identity not working

**Symptoms:**

- Managed Identity option is available but authentication fails
- Error: "Managed identity authentication is not available"

**Solutions:**

1. Verify `managed_identity_enabled = true` is set in the Grafana server configuration under `[azure]`.
1. Confirm the Azure resource hosting Grafana has managed identity enabled.
1. For user-assigned managed identity, ensure `managed_identity_client_id` is set correctly.
1. Verify the managed identity has the `Reader` role on the target resources.
1. Restart Grafana after changing server configuration.

### Workload Identity not working

**Symptoms:**

- Workload Identity authentication fails in Kubernetes/AKS environment
- Token file errors

**Solutions:**

1. Verify `workload_identity_enabled = true` is set in the Grafana server configuration.
1. Check that the service account is correctly annotated for workload identity.
1. Verify the federated credential is configured in Azure.
1. Ensure the token path is accessible to the Grafana Pod.
1. Check the workload identity webhook is running in the cluster.

### "401 Unauthorized" despite correct Azure setup

**Symptoms:**

- Authentication fails with `401 Unauthorized` even though Managed Identity or Workload Identity is correctly configured in Azure
- The managed identity has the correct RBAC roles
- `managed_identity_enabled` or `workload_identity_enabled` is set to `true` in the Grafana `.ini` file

**Cause:** The `forward_settings_to_plugins` setting under `[azure]` doesn't include the Azure Monitor plugin, so the plugin doesn't receive the Azure authentication settings from the Grafana server.

**Solutions:**

1. Check if you've customized the `forward_settings_to_plugins` setting under `[azure]` in your Grafana `.ini` file.
1. If customized, ensure `grafana-azure-monitor-datasource` is listed. For example:
   ```ini
   [azure]
   managed_identity_enabled = true
   forward_settings_to_plugins = grafana-azure-monitor-datasource
   ```
1. By default, Grafana includes all Grafana Labs Azure plugins. If you haven't customized this setting, the default includes the Azure Monitor plugin.
1. Restart Grafana after making changes.

## Query errors

These errors occur when executing queries against Azure Monitor services.

### "No data" or empty results

**Symptoms:**

- Query executes without error but returns no data
- Charts show "No data" message

**Possible causes and solutions:**

| Cause                             | Solution                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Time range doesn't contain data   | Expand the dashboard time range or verify data exists in Azure Portal.                                                           |
| Wrong resource selected           | Verify you've selected the correct subscription, resource group, and resource.                                                   |
| Metric not available for resource | Not all metrics are available for all resources. Check available metrics in Azure Portal under the resource's **Metrics** blade. |
| Metric has no values              | Some metrics only populate under certain conditions (for example, error counts when errors occur).                               |
| Permissions issue                 | Verify the identity has read access to the specific resource.                                                                    |

### "Bad request" or "Invalid query"

**Symptoms:**

- Query fails with 400 error
- Error message indicates query syntax issues

**Solutions for Logs queries:**

1. Validate your KQL syntax in the Azure Portal Log Analytics query editor.
1. Check for typos in table names or column names.
1. Ensure referenced tables exist in the selected workspace.
1. Verify the time range is valid (not in the future, not too far in the past for data retention).

**Solutions for Metrics queries:**

1. Verify the metric name is valid for the selected resource type.
1. Check that dimension filters use valid dimension names and values.
1. Ensure the aggregation type is supported for the selected metric.

### "Resource not found"

**Symptoms:**

- Query fails with 404 error
- Resource picker shows resources that can't be queried

**Solutions:**

1. Verify the resource still exists in Azure (it may have been deleted or moved).
1. Check that the subscription is correct.
1. Refresh the resource picker by re-selecting the subscription.
1. Verify the identity has access to the resource's resource group.

### Logs query timeout

**Symptoms:**

- Query runs for a long time then fails with `DatasourceError` or `context deadline exceeded`
- Alert evaluations fail with timeout errors
- Error mentions timeout or query limits

**Cause:** The default data source timeout in Grafana is 30 seconds, but Azure Log Analytics queries can take up to 3 minutes on the Azure side, especially for complex KQL queries or large time ranges.

**Solutions:**

1. **Increase the data source timeout.** Open the Azure Monitor data source settings, scroll to the **Misc** section, and increase the **Timeout** to `300` (seconds). Refer to [Query timeout](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/#query-timeout) for details.
1. Narrow the time range to reduce data volume.
1. Add filters to reduce the result set.
1. Use `summarize` to aggregate data instead of returning raw rows.
1. Consider using Basic Logs for large datasets (if enabled).
1. Break complex queries into smaller parts.
1. For alerting, ensure the alert evaluation interval is long enough to accommodate the query duration plus the configured timeout.

### "Metrics not available" for a resource

**Symptoms:**

- Resource appears in picker but no metrics are listed
- Metric dropdown is empty

**Solutions:**

1. Verify the resource type supports Azure Monitor metrics.
1. Check if the resource is in a region that supports metrics.
1. Some resources require diagnostic settings to emit metrics—configure these in Azure Portal.
1. Try selecting a different namespace for the resource.

## Azure Resource Graph errors

These errors are specific to Azure Resource Graph (ARG) queries.

### "Query execution failed"

**Symptoms:**

- ARG query fails with execution errors
- Results don't match expected resources

**Solutions:**

1. Validate query syntax in Azure Portal Resource Graph Explorer.
1. Check that you have access to the subscriptions being queried.
1. Verify table names are correct (for example, `Resources`, `ResourceContainers`).
1. Some ARG features require specific permissions, check [ARG documentation](https://docs.microsoft.com/en-us/azure/governance/resource-graph/).

### Query returns incomplete results

**Symptoms:**

- Not all expected resources appear in results
- Results seem truncated

**Solutions:**

1. ARG queries are paginated. The data source handles pagination automatically, but very large result sets may be limited.
1. Add filters to reduce result set size.
1. Verify you have access to all subscriptions containing the resources.

## Application Insights Traces errors

These errors are specific to the Traces query type.

### "No traces found"

**Symptoms:**

- Trace query returns empty results
- Operation ID search finds nothing

**Solutions:**

1. Verify the Application Insights resource is collecting trace data.
1. Check that the time range includes when the traces were generated.
1. Ensure the Operation ID is correct (copy directly from another trace or log).
1. Verify the identity has access to the Application Insights resource.

## Basic Logs errors

These errors are specific to Basic Logs queries.

### Basic Logs toggle is not available

**Symptoms:**

- The **Analytics / Basic** toggle doesn't appear in the Logs query editor
- Unable to switch to Basic Logs mode

**Solutions:**

1. Verify **Enable Basic Logs** is toggled on in the data source configuration. Refer to [Enable Basic Logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/#enable-basic-logs).
1. Basic Logs isn't available when creating alert rules. If you're in the alerting UI, use Analytics mode instead.

### Basic Logs query returns errors

**Symptoms:**

- Query fails with "BadArgumentError" or similar errors
- Query returns unexpected results

**Solutions:**

1. Ensure you've selected only a single workspace resource. Basic Logs doesn't support multi-resource queries.
1. Remove any time-range filters from the query itself. Basic Logs always uses the dashboard time range.
1. Verify the table you're querying is configured with the Basic or Auxiliary log plan in Azure. Not all tables support Basic Logs.
1. Check that your KQL query uses only [supported operators](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-query?tabs=portal-1#limitations).

### Unexpected costs from Basic Logs

**Solutions:**

1. Basic Logs queries are billed per query by Azure, separate from Grafana costs. Review the [Azure pricing documentation](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-query?tabs=portal-1).
1. Check your query frequency. Dashboard auto-refresh and variable changes can trigger repeated queries.
1. Consider switching infrequently queried tables back to Analytics mode to avoid per-query charges.

## Alerting errors

These errors occur when using Azure Monitor data in Grafana alert rules or recording rules. For general alerting configuration, refer to the [Azure Monitor alerting documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/alerting/).

### Alerting fails with Current User authentication

**Symptoms:**

- Alert rules and recording rules fail with authentication errors
- Dashboard queries work, but alerting evaluations do not
- Error messages reference missing or invalid credentials during background evaluation

**Cause:** Current User authentication relies on the logged-in user's credentials, which aren't available for background operations like alerting.

**Solutions:**

1. Configure **fallback service credentials** in the data source settings. Typically this means adding an App Registration (client secret) as the fallback.
1. Verify the fallback credentials have the required Azure RBAC permissions on the resources used in your alert rules.
1. Refer to [Limitations and fallback credentials](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/#limitations-and-fallback-credentials) for configuration details.

### Alert evaluation timeout

**Symptoms:**

- Alert rules fail with `DatasourceError` or `context deadline exceeded`
- Alerts work intermittently, failing when queries take longer than usual

**Solutions:**

1. **Increase the data source timeout.** The default is 30 seconds, but Azure Log Analytics queries can take up to 3 minutes. Open the Azure Monitor data source settings, scroll to **Misc**, and set **Timeout** to `300`. Refer to [Query timeout](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/#query-timeout).
1. Ensure the alert evaluation interval is long enough to accommodate the query duration.
1. Simplify complex KQL queries used in alert rules.
1. Reduce the time range in Log Analytics queries.

## Template variable errors

For general template variable configuration, refer to the [template variables documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/template-variables/).

### "Properties found in series but missing `valueProp` and `textProp`"

**Symptoms:**

- Template variables using query types such as **Resource Groups**, **Resource Names**, or **Subscriptions** fail with this error
- Variables that previously worked stop returning values after a Grafana upgrade
- Dashboards that rely on cascading variables break

**Cause:** This error occurs when the Azure Monitor plugin's variable query response format doesn't match what Grafana expects. This was a known bug that affected specific Grafana versions.

**Solutions:**

1. **Check your Grafana version.** This issue was a software bug fixed in later releases. Update to the latest Grafana patch release for your version.
1. **Grafana Cloud users:** If you're on a release channel that doesn't yet include the fix, switch to the **stable** channel in your Cloud stack settings (**Stack Management** > **General** > **Release channel**) to receive the latest stable patch.
1. **Self-hosted users:** Download the latest patch release from the [Grafana download page](https://grafana.com/grafana/download).
1. After upgrading, reload the dashboard and re-run the variable queries.

### Variables return no values

**Solutions:**

1. Verify the data source connection is working (test it in the data source settings).
1. Check that parent variables (for cascading variables) have valid selections.
1. Verify the identity has permissions to list the requested resources.
1. For Logs variables, ensure the KQL query returns a single column.

### Variables stop working after a Grafana upgrade

**Symptoms:**

- Template variables that worked before an upgrade return errors or empty results
- Dashboard variable dropdowns show no options or display error indicators

**Solutions:**

1. Check the [Grafana release notes](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/whatsnew/) for breaking changes related to template variables or the Azure Monitor data source.
1. Verify the Azure Monitor plugin version is compatible with your Grafana version. Go to **Administration** > **Plugins and data** > **Plugins**, search for "Azure Monitor", and check the version.
1. Clear the browser cache and reload the dashboard.
1. Re-open the variable configuration and click **Run query** to verify it returns expected results.
1. If the issue persists, check for known bugs in the [Grafana GitHub issues](https://github.com/grafana/grafana/issues?q=is%3Aissue+label%3A%22datasource%2Fazure-monitor%22+template+variable) and consider rolling back to the previous Grafana version.

### Variables are slow to load

**Solutions:**

1. Set variable refresh to **On dashboard load** instead of **On time range change**.
1. Reduce the scope of variable queries (for example, filter by resource group instead of entire subscription).
1. For Logs variables, optimize the KQL query to return results faster.

## Enable debug logging

To capture detailed error information for troubleshooting Azure Monitor issues:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Restart Grafana for the change to take effect.
1. Reproduce the issue and review the logs at `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for entries containing `azuremonitor` or `azure` for Azure Monitor-specific request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried the solutions in this document and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Azure Monitor data source GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. Contact Grafana Support if you're an Enterprise, Cloud Pro, or Cloud Contracted user.
1. When reporting issues, include:
   - Grafana version
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration (redact credentials)
