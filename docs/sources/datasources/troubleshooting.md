---
description: Solutions to common issues when configuring and querying data sources in Grafana.
keywords:
  - grafana
  - data source
  - troubleshooting
  - connection
  - authentication
  - query
  - errors
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot general data sources
weight: 900
review_date: 2026-03-10
refs:
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  private-data-source-connect:
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
---

# Troubleshoot general data source issues

This page provides solutions to common issues that apply across data sources in Grafana. For troubleshooting specific to a data source, refer to the troubleshooting page within each data source's documentation.

## Connection errors

These errors occur when Grafana can't reach the data source backend.

### "Connection refused" or timeout errors

**Symptoms:**

- **Save & test** fails with a connection error or timeout
- Panels show "error" or fail to load data
- Intermittent connectivity issues

**Possible causes and solutions:**

| Cause                     | Solution                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incorrect URL             | Verify the data source URL is correct, including the protocol (`http://` or `https://`) and port number.                                             |
| Network or firewall rules | Ensure the Grafana server can reach the data source endpoint. Check that firewall rules allow outbound traffic on the required port.                 |
| Data source is down       | Verify the data source service is running and accepting connections.                                                                                 |
| DNS resolution failure    | Confirm the hostname resolves correctly from the Grafana server.                                                                                     |
| Private network access    | If the data source is on a private network and you're using Grafana Cloud, configure [Private data source connect](ref:private-data-source-connect). |

### TLS/SSL errors

**Symptoms:**

- Errors mentioning "certificate," "TLS handshake," or "x509"
- **Save & test** fails with SSL-related messages

**Solutions:**

1. Verify the data source is using a valid TLS certificate.
1. If you're using a self-signed certificate, enable **Skip TLS Verify** in the data source configuration (not recommended for production) or add the CA certificate to the list of trusted certificates in Grafana.
1. Ensure the certificate hasn't expired.
1. Confirm the certificate's Common Name or Subject Alternative Name matches the hostname in the data source URL.

## Authentication errors

These errors occur when credentials are invalid, missing, or lack the required permissions.

### "Unauthorized" or "Access denied"

**Symptoms:**

- **Save & test** fails with `401 Unauthorized` or `403 Forbidden`
- Queries return access denied messages
- Drop-down menus don't populate

**Possible causes and solutions:**

| Cause                       | Solution                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid credentials         | Double-check the username, password, API key, or token. Regenerate credentials if necessary.                                                               |
| Expired credentials         | Create new credentials and update the data source configuration.                                                                                           |
| Insufficient permissions    | Ensure the account or API key has the permissions required by the data source. Refer to the specific data source's documentation for required permissions. |
| Wrong authentication method | Verify you've selected the correct authentication type for your setup.                                                                                     |

## Query errors

These errors occur when executing queries against a properly connected data source.

### "No data" or empty results

**Symptoms:**

- Queries execute without error but return no data
- Panels show "No data"
- Graphs are empty

**Possible causes and solutions:**

| Cause                           | Solution                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Time range doesn't contain data | Expand the dashboard time range or verify data exists in the data source for the selected period. |
| Incorrect query                 | Review the query syntax. Use the data source's query editor to build or validate the query.       |
| Wrong data source selected      | Verify you've selected the correct data source in the panel or Explore.                           |
| Permissions issue               | Ensure the credentials have read access to the specific resource or index being queried.          |

### Query timeout

**Symptoms:**

- Queries run for a long time then fail
- Error messages mention timeout or query limits

**Solutions:**

1. Narrow the dashboard time range to reduce the volume of data.
1. Add filters to the query to reduce the result set.
1. Break complex queries into smaller parts.
1. Increase the data source timeout setting if your data source legitimately needs more time.

## Data source configuration errors

### "Save & test" fails after provisioning

**Symptoms:**

- Provisioned data sources fail the connection test
- Errors appear after deploying provisioning YAML files

**Solutions:**

1. Verify the provisioning YAML syntax is correct. Refer to [Provision data sources](ref:provisioning-data-sources) for the expected format.
1. Ensure `secureJsonData` values (such as passwords, API keys, and tokens) are set correctly. These values can't be read back after being saved.
1. Check that the provisioning file is in the correct directory and that Grafana has read access.
1. Restart Grafana after making changes to provisioning files.

### Data source disappears or resets

**Symptoms:**

- Data source changes revert after Grafana restarts
- Data source configuration can't be saved through the UI

**Solutions:**

1. Provisioned data sources can't be edited through the UI. Make changes in the provisioning YAML file instead.
1. Verify no other provisioning file is overwriting your data source configuration.

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Restart Grafana for the change to take effect.
1. Reproduce the issue and review logs at `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for entries related to your data source that include request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If the solutions on this page don't resolve your issue:

1. Check the troubleshooting page for your specific data source.
1. Search the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review [Grafana GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. Contact [Grafana Support](https://grafana.com/support/) if you're a Grafana Enterprise, Cloud Pro, or Cloud Advanced user.

When reporting issues, include:

- Grafana version and data source plugin version
- Exact error messages (redact sensitive information)
- Steps to reproduce the issue
- Relevant configuration (redact credentials)
