---
aliases:
  - ../../fundamentals/contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/
  - ../../fundamentals/contact-points/contact-point-types/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/contact-point-types/
  - ../../contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/contact-points/
  - ../../unified-alerting/contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/contact-points/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/contact-points/
description: Learn about contact points and the supported contact point integrations
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - notification channel
  - create
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Contact points
weight: 112
refs:
  import-alertmanager-configuration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/import-alertmanager-configuration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/import-alertmanager-configuration/
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points
  grafana-and-legacy-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/grafana-and-legacy-templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/grafana-and-legacy-templates/
---

# Contact points

Contact points contain the configuration for sending alert notifications. You can assign a contact point either in the alert rule or notification policy options.

A contact point includes one or more contact point integrations for sending alert notifications, such as:

{{< column-list >}}

- Alertmanager
- Amazon SNS
- Cisco Webex Teams
- DingDing
- Discord
- Email
- Google Chat
- Grafana IRM
- Jira
- Kafka REST Proxy
- Line
- Microsoft Teams
- MQTT
- Opsgenie
- PagerDuty
- Pushover
- Sensu Go
- Slack
- Telegram
- Threema Gateway
- VictorOps
- Webhook
- WeCom

{{< /column-list >}}

For example, a contact point could contain a PagerDuty integration; an email and Slack integration; or a PagerDuty integration, a Slack integration, and two email integrations. You can also configure a contact point with no integrations; in which case no notifications are sent.

Each contact point integration can also define the notification message to be sent, which can use the predefined message, a custom message, or notification templates.

## Contact points, receivers, and integrations

A contact point, also known as a _receiver_, groups integrations under one name. Each integration is a configured destination, such as a Slack channel or an email address list. Notifications go to each integration in the selected contact point.

An integration has a _type_, such as Slack, and a _version_ that identifies its configuration and notification behavior. This version isn't the destination service's API version. Grafana integrations use `v1`. The UI labels Mimir-compatible integrations as **Legacy** (`v0mimir1`) or **Legacy v2** (`v0mimir2`). Not every type supports every version.

When you create an integration using the contact point editor or file provisioning, Grafana uses the `v1` format. The notifications API exposes a `version` field for each integration in a receiver. For the schema, refer to the [Grafana App Platform notifications API](https://editor.swagger.io/?url=https://raw.githubusercontent.com/grafana/grafana/main/packages/grafana-openapi/src/apis/notifications.alerting.grafana.app-v1beta1.json) (`notifications.alerting.grafana.app/v1beta1`).

## Grafana and Legacy templates

Each integration's version determines whether it uses Grafana or Legacy templates. Grafana integrations (`v1`) use Grafana templates (API kind `grafana`). Legacy integrations (`v0mimir1` and `v0mimir2`) use Legacy templates (API kind `mimir`).

A contact point can contain a mix of Grafana and Legacy integrations. The alert's origin doesn't determine template selection. Grafana and Legacy templates have separate definition namespaces, so they don't share named definitions.

For differences in defaults, functions, notification data, and template dependencies, refer to [Grafana and Legacy notification templates](ref:grafana-and-legacy-templates).

## Replace a Legacy integration

After you promote an imported Alertmanager configuration, you can modify its Legacy integrations through the notification APIs and the Grafana user interface. An Alertmanager configuration import is the supported way to create Legacy integrations.

To move from a Legacy integration to a Grafana integration, replace the Legacy integration manually. Updating an integration's version from `v0mimir1` or `v0mimir2` to `v1` isn't a supported upgrade path. The replacement has different configuration and notification behavior, and uses Grafana templates instead of Legacy templates.

Before you begin:

- **A promoted configuration:** If your import is still staged, [promote the imported configuration](ref:import-alertmanager-configuration) before editing or replacing its integrations.
- **Integration details:** The Legacy integration's destination, notification settings, and named template dependencies.
- **Permissions and credentials:** Permission to edit the contact point, and the credentials needed for the replacement.

To replace a Legacy integration, complete the following steps.

1. Add a new Grafana integration for the destination. Configure it using the Grafana integration's settings rather than copying the Legacy configuration unchanged. For instructions, refer to [Configure contact points](ref:configure-contact-points).
1. Adapt the notification templates for the Grafana integration. Check named definitions and their dependencies, built-in defaults, functions, and available data. A definition in a Legacy template group isn't available to the new integration. Refer to [Grafana and Legacy notification templates](ref:grafana-and-legacy-templates).
1. Test the replacement integration's notification delivery and message content, including resolved notifications if enabled.
1. Remove the Legacy integration after verifying the replacement. If you create a separate contact point, update the alert rules or notification policies that reference the old contact point before removing it.

If both integrations are active in the same contact point, each receives notifications. Plan the replacement to avoid unintended duplicate notifications or a gap in delivery.
