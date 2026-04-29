---
aliases:
  - ../data-sources/alertmanager/
  - ../features/datasources/alertmanager/
description: Use the Alertmanager data source to manage silences, contact points, and notification policies in the Grafana Alerting UI.
keywords:
  - grafana
  - prometheus
  - alertmanager
  - mimir
  - cortex
  - silences
  - contact points
  - notification policies
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alertmanager
title: Alertmanager data source
weight: 150
review_date: 2026-04-29
---

# Alertmanager data source

Grafana includes built-in support for Alertmanager implementations in Prometheus and Grafana Mimir. After you add an Alertmanager data source, you can use the **Choose Alertmanager** drop-down in [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/) to view and manage Alertmanager resources such as silences, contact points, and notification policies. You can also enable the Alertmanager to receive Grafana-managed alerts.

## Alertmanager implementations

The data source supports the following Alertmanager implementations. You can specify the implementation on the data source's **Settings** page.

| Implementation | Silences | Contact points | Notification policies | Templates |
|----------------|----------|----------------|----------------------|-----------|
| **Mimir** (default) | Read/write | Read/write | Read/write | Read/write |
| **Cortex** | Read/write | Read/write | Read/write | Read/write |
| **Prometheus** | Read/write | Read-only | Read-only | Read-only |

When using the Prometheus implementation, you can manage silences in the Grafana Alerting UI. Contact points, notification policies, and templates are read-only because the Prometheus Alertmanager API does not support write operations for these resources.

## Configure the data source

To add and configure the Alertmanager data source, complete the following steps:

<!-- vale Grafana.WordList = NO -->
{{< docs/shared lookup="alerts/add-alertmanager-ds.md" source="grafana" version="<GRAFANA_VERSION>" >}}
<!-- vale Grafana.WordList = YES -->

### Authentication

The data source supports all standard Grafana HTTP authentication methods, including basic auth and TLS. When SigV4 authentication is enabled globally in Grafana, it's also available for this data source.

For more information about authentication options and connection settings, refer to [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

### Verify the connection

Click **Save & test** to verify the connection. A successful connection returns `Health check passed.`

{{< admonition type="note" >}}
If you're using the Mimir implementation and Mimir Alertmanager hasn't been configured yet, the health check may still pass. This is expected behavior when Mimir is running in lazy configuration mode.
{{< /admonition >}}

## Provision the data source

You can provision Alertmanager data sources using configuration files or Terraform.

The `jsonData` fields used across both methods are:

| Field | Description |
|-------|-------------|
| `implementation` | The Alertmanager implementation. Supported values: `mimir`, `cortex`, `prometheus`. Defaults to `mimir`. |
| `handleGrafanaManagedAlerts` | When `true`, this Alertmanager receives Grafana-managed alerts. You must also enable alert forwarding in **Alerting** > **Administration** in the Grafana UI. |

### Configuration file

For more information, refer to [Provisioning data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

```yaml
apiVersion: 1

datasources:
  - name: Alertmanager
    type: alertmanager
    url: http://localhost:9093
    access: proxy
    jsonData:
      implementation: prometheus
      handleGrafanaManagedAlerts: false
    basicAuth: true
    basicAuthUser: <USERNAME>
    secureJsonData:
      basicAuthPassword: <PASSWORD>
```

### Terraform

To provision the data source with Terraform, use the [`grafana_data_source` resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source):

```hcl
resource "grafana_data_source" "alertmanager" {
  name = "Alertmanager"
  type = "alertmanager"
  url  = "http://localhost:9093"

  json_data_encoded = jsonencode({
    implementation            = "prometheus"
    handleGrafanaManagedAlerts = false
  })
}
```

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).

## Troubleshoot the data source

This section covers common issues when configuring or using the Alertmanager data source.

### "Health check failed."

**Symptoms:**

- **Save & test** returns `Health check failed.`
- The Alertmanager URL may be unreachable or returning an unexpected response.

**Possible causes and solutions:**

| Cause | Solution |
|-------|----------|
| Incorrect URL | Verify the URL points to your Alertmanager instance and includes the correct protocol, host, and port (for example, `http://localhost:9093`). |
| Network or firewall issue | Verify that the Grafana server can reach the Alertmanager endpoint. Check firewall rules and DNS resolution. |
| Wrong implementation selected | If you changed the implementation type, re-test the connection. See the implementation mismatch errors below. |
| Incorrect credentials | If basic auth is enabled, verify the username and password are correct. |

### "It looks like you have chosen Prometheus implementation, but detected a Mimir or Cortex endpoint."

**Symptoms:**

- **Save & test** fails with this message when **Alertmanager Implementation** is set to **Prometheus**.

**Solution:**

The URL you entered is a Mimir or Cortex Alertmanager endpoint, not a Prometheus one. Change **Alertmanager Implementation** to **Mimir** or **Cortex** and click **Save & test** again.

### "It looks like you have chosen a Mimir or Cortex implementation, but detected a Prometheus endpoint."

**Symptoms:**

- **Save & test** fails with this message when **Alertmanager Implementation** is set to **Mimir** or **Cortex**.

**Solution:**

The URL you entered is a Prometheus Alertmanager endpoint. Change **Alertmanager Implementation** to **Prometheus** and click **Save & test** again.

### Grafana-managed alerts are not being received

**Symptoms:**

- Grafana-managed alert instances don't appear in this Alertmanager.
- The **Receive Grafana Alerts** toggle is enabled in the data source settings, but no alerts arrive.

**Solution:**

Enabling **Receive Grafana Alerts** on the data source alone isn't enough. You must also enable alert forwarding in **Alerting** > **Administration** in the Grafana UI. Both settings must be on for Grafana-managed alerts to be forwarded to this Alertmanager.

### Contact points and notification policies are read-only

**Symptoms:**

- You can view but not edit contact points, notification policies, or templates in the Grafana Alerting UI.

**Cause:**

You're using the **Prometheus** implementation. The Prometheus Alertmanager API doesn't support write operations for these resources.

**Solution:**

If you need full read/write access to contact points and notification policies, switch to a **Mimir** or **Cortex** Alertmanager and update the **Alertmanager Implementation** setting.

## Related resources

- [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/)
- [Configure external Alertmanagers](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/)
- [Prometheus Alertmanager documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Grafana Mimir documentation](https://grafana.com/docs/mimir/latest/)
- [Grafana community forums](https://community.grafana.com/)
