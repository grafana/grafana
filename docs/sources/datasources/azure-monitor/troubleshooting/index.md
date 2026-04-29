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
last_reviewed: 2025-12-04
---

# Troubleshoot Azure Monitor data source issues

This document provides solutions to common issues you may encounter when configuring or using the Azure Monitor data source.

## Configuration and authentication errors

These errors typically occur when setting up the data source or when authentication credentials are invalid.

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
2. Verify the client secret was copied correctly (no extra spaces or truncation).
3. Check if the secret has expired in Azure Portal under **App registrations** > your app > **Certificates & secrets**.
4. Create a new secret and update the data source configuration.

### "Tenant not found" or "Invalid tenant ID"

**Symptoms:**

- Data source test fails with tenant-related errors
- Unable to authenticate

**Solutions:**

1. Verify the Directory (tenant) ID in Azure Portal under **Microsoft Entra ID** > **Overview**.
2. Ensure you're using the correct Azure cloud setting (Azure, Azure Government, or Azure China).
3. Check that the tenant ID is a valid GUID format.

### Managed Identity not working

**Symptoms:**

- Managed Identity option is available but authentication fails
- Error: "Managed identity authentication is not available"

**Solutions:**

1. Verify `managed_identity_enabled = true` is set in the Grafana server configuration under `[azure]`.
2. Confirm the Azure resource hosting Grafana has managed identity enabled.
3. For user-assigned managed identity, ensure `managed_identity_client_id` is set correctly.
4. Verify the managed identity has the `Reader` role on the target resources.
5. Restart Grafana after changing server configuration.

### Workload Identity not working

**Symptoms:**

- Workload Identity authentication fails in Kubernetes/AKS environment
- Token file errors

**Solutions:**

1. Verify `workload_identity_enabled = true` is set in the Grafana server configuration.
2. Check that the service account is correctly annotated for workload identity.
3. Verify the federated credential is configured in Azure.
4. Ensure the token path is accessible to the Grafana pod.
5. Check the workload identity webhook is running in the cluster.

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
| Metric has no values              | Some metrics only populate under certain conditions (e.g., error counts when errors occur).                                      |
| Permissions issue                 | Verify the identity has read access to the specific resource.                                                                    |

### "Bad request" or "Invalid query"

**Symptoms:**

- Query fails with 400 error
- Error message indicates query syntax issues

**Solutions for Logs queries:**

1. Validate your KQL syntax in the Azure Portal Log Analytics query editor.
2. Check for typos in table names or column names.
3. Ensure referenced tables exist in the selected workspace.
4. Verify the time range is valid (not in the future, not too far in the past for data retention).

**Solutions for Metrics queries:**

1. Verify the metric name is valid for the selected resource type.
2. Check that dimension filters use valid dimension names and values.
3. Ensure the aggregation type is supported for the selected metric.

### "Resource not found"

**Symptoms:**

- Query fails with 404 error
- Resource picker shows resources that can't be queried

**Solutions:**

1. Verify the resource still exists in Azure (it may have been deleted or moved).
2. Check that the subscription is correct.
3. Refresh the resource picker by re-selecting the subscription.
4. Verify the identity has access to the resource's resource group.

### Logs query timeout

**Symptoms:**

- Query runs for a long time then fails
- Error mentions timeout or query limits

**Solutions:**

1. Narrow the time range to reduce data volume.
2. Add filters to reduce the result set.
3. Use `summarize` to aggregate data instead of returning raw rows.
4. Consider using Basic Logs for large datasets (if enabled).
5. Break complex queries into smaller parts.

### "Metrics not available" for a resource

**Symptoms:**

- Resource appears in picker but no metrics are listed
- Metric dropdown is empty

**Solutions:**

1. Verify the resource type supports Azure Monitor metrics.
2. Check if the resource is in a region that supports metrics.
3. Some resources require diagnostic settings to emit metrics—configure these in Azure Portal.
4. Try selecting a different namespace for the resource.

## Azure Resource Graph errors

These errors are specific to Azure Resource Graph (ARG) queries.

### "Query execution failed"

**Symptoms:**

- ARG query fails with execution errors
- Results don't match expected resources

**Solutions:**

1. Validate query syntax in Azure Portal Resource Graph Explorer.
2. Check that you have access to the subscriptions being queried.
3. Verify table names are correct (e.g., `Resources`, `ResourceContainers`).
4. Some ARG features require specific permissions, check [ARG documentation](https://docs.microsoft.com/en-us/azure/governance/resource-graph/).

### Query returns incomplete results

**Symptoms:**

- Not all expected resources appear in results
- Results seem truncated

**Solutions:**

1. ARG queries are paginated. The data source handles pagination automatically, but very large result sets may be limited.
2. Add filters to reduce result set size.
3. Verify you have access to all subscriptions containing the resources.

## Application Insights Traces errors

These errors are specific to the Traces query type.

### "No traces found"

**Symptoms:**

- Trace query returns empty results
- Operation ID search finds nothing

**Solutions:**

1. Verify the Application Insights resource is collecting trace data.
2. Check that the time range includes when the traces were generated.
3. Ensure the Operation ID is correct (copy directly from another trace or log).
4. Verify the identity has access to the Application Insights resource.

## Template variable errors

For detailed troubleshooting of template variables, refer to the [template variables troubleshooting section](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/template-variables/).

### Variables return no values

**Solutions:**

1. Verify the data source connection is working (test it in the data source settings).
2. Check that parent variables (for cascading variables) have valid selections.
3. Verify the identity has permissions to list the requested resources.
4. For Logs variables, ensure the KQL query returns a single column.

### Variables are slow to load

**Solutions:**

1. Set variable refresh to **On dashboard load** instead of **On time range change**.
2. Reduce the scope of variable queries (e.g., filter by resource group instead of entire subscription).
3. For Logs variables, optimize the KQL query to return results faster.

## Connection and network errors

These errors indicate problems with network connectivity between Grafana and Azure services.

### "Connection refused" or timeout errors

**Symptoms:**

- Data source test fails with network errors
- Queries timeout without returning results

**Solutions:**

1. Verify network connectivity from Grafana to Azure endpoints.
2. Check firewall rules allow outbound HTTPS (port 443) to Azure services.
3. For private networks, ensure Private Link or VPN is configured correctly.
4. For Grafana Cloud, configure [Private Data Source Connect](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/) if accessing private resources.

### SSL/TLS certificate errors

**Symptoms:**

- Certificate validation failures
- SSL handshake errors

**Solutions:**

1. Ensure the system time is correct (certificate validation fails with incorrect time).
2. Verify corporate proxy isn't intercepting HTTPS traffic.
3. Check that required CA certificates are installed on the Grafana server.

## Get additional help

If you've tried the solutions above and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [Azure Monitor data source GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. Enable debug logging in Grafana to capture detailed error information.
1. Contact Grafana Support if you're an Enterprise, Cloud Pro or Cloud Contracted user.
1. When reporting issues, include:
   - Grafana version
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Relevant configuration (redact credentials)
