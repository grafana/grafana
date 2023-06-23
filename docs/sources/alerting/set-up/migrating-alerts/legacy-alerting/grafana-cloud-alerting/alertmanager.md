---
aliases:
  - /docs/grafana-cloud/alerts/grafana-cloud-alerting/alertmanager/
  - /docs/grafana-cloud/how-do-i/grafana-cloud-alerting/alertmanager/
  - /docs/grafana-cloud/legacy-alerting/grafana-cloud-alerting/alertmanager/
description: Alertmanager
title: Alertmanager
weight: 500
---

# Alertmanager

Grafana Cloud Alerting allows you to edit and view configuration for your Alertmanager directly inside of Grafana. See the official [Alertmanager documentation](https://prometheus.io/docs/alerting/latest/configuration/) to learn how to configure.

{{% admonition type="note" %}}
Only organization Admins can view or update Alertmanger configurations.
{{% /admonition %}}

## Edit a config for Grafana Cloud Alerting

1. In Grafana, hover your cursor over the **Grafana Cloud Alerting** icon and then click **Alertmanager**.
1. If you have more than one Alertmanager source, there will be a dropdown at the top for you to select the data source to edit configurations.
1. Currently active configuration for the Alertmanager will be displayed. Click the **Edit** button to enter edit mode and start making changes. Click "Save and finish editing" once done to persist your changes.
1. Alternatively, updates to the Alertmanager configurations made using the mimirtool will also sync and appear here.

## Use the Grafana Labs-supplied SMTP option to configure email notifications

Grafana Cloud users who do not have an SMTP server available for sending alert emails may use Grafana-Labs supplied SMTP relay (available at `smtprelay:2525`).

1. In Grafana, hover your cursor over the **Grafana Cloud Alerting** icon and then click **Alertmanager**.
1. If you have more than one Alertmanager source, there will be a dropdown at the top for you to select the data source to edit configurations.
1. Find info box with heading **Send alert email notifications from Grafana Cloud** at the top
1. Enter desired email address into the **email address** field
1. Click **Update configuration** button. Alertmanager config will be updated with grafana SMTP relay settings and an "email" receiver that will send to the specified email address.

{{% admonition type="note" %}}
Following these steps will overwrite any custom global SMTP settings that you might have. Default route configuration will send all notifications to the "email" receiver. If you have already customized routes, they will not be updated and you will have to configure "email" receiver on the appropriate route.
{{% /admonition %}}

Use these settings in your Grafana Cloud Alerting YAML, if you do not find them already set. Most important is the `smtp_require_tls: false` line. If this is not set properly, alert emails will not be received. If you use mimirtool to configure alertmanager, by default this will be set to `true`, which will cause problems.

```yaml
global:
  smtp_from: noreply@grafana.net
  smtp_smarthost: smtprelay:2525
  smtp_require_tls: false
```

## Troubleshooting Alertmanager failures

Configuration errors can cause Alertmanager notification failures, e.g. a typo in an email address recipient or an expired token for a webhook. Grafana Cloud provisions a Loki datasource `grafanacloud-<stack_slug>-usage-insights` which can be used to display select notification errors with a query similar to the example below. The `instance_type` label of `alerts` is what selects the Grafana Cloud Alertmanager logs.

```sql
{instance_type="alerts"} | logfmt | level="warn"
```
