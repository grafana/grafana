---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/import-alertmanager-configuration/
description: Import contact points, notification policies, templates, time intervals, and inhibition rules from a Prometheus, Mimir, or Cortex Alertmanager into Grafana. Stage the configuration as a read-only copy, review it, then promote or revert it.
keywords:
  - grafana
  - alerting
  - import
  - alertmanager
  - migration
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Import Alertmanager configuration to Grafana
menuTitle: Import Alertmanager configuration
weight: 210
refs:
  convert-api:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/convert-api/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/convert-api/
  import-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alerting-migration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/alerting-migration/
  configure-alertmanager:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager/
  contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-notification-policy/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-notification-policy/
  templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
  time-intervals:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings/
  inhibition-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/inhibition-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/inhibition-rules/
  rbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/
  configure-feature-toggles:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/
---

# Import Alertmanager configuration to Grafana

{{< docs/public-preview product="Alertmanager configuration import" >}}

You can import notification configuration from a Prometheus, Mimir, or Cortex Alertmanager into Grafana. The Import Alertmanager configuration tool imports contact points, the notification policy tree, notification templates, time interval configurations, and inhibition rules into Grafana Alerting.

The import process is a staged operation. Grafana first saves the incoming configuration as a read-only copy that doesn't affect notification delivery. You review that copy, then either promote it into your live configuration or revert it.

This page covers notification configuration only. To convert alert rules and recording rules from Mimir, Loki, or Prometheus into Grafana-managed rules, refer to [import data source-managed rules to Grafana-managed rules](ref:import-rules).

## Before you begin

Ensure you have the following:

- **Feature toggles enabled**: This feature is in public preview and is off by default. Enable both `alertingMigrationWizardUI`, which adds the **Import** tab and the import wizard, and `alertingImportAlertmanagerAPI`, which adds the API endpoints the import uses. For more details, refer to [configure feature toggles](ref:configure-feature-toggles).
- **The organization Admin role**: The **Import** tab under **Alerting** > **Settings** is only available to organization administrators.
- **An import source**: The import tool accepts either an Alertmanager data source that Grafana can reach, or an Alertmanager configuration YAML file.
- **RBAC permissions**: The following [RBAC](ref:rbac) actions apply:

  | Action                                                          | Needed to                                            |
  | --------------------------------------------------------------- | ---------------------------------------------------- |
  | `notifications.alerting.grafana.app/alertmanagerimports:create` | Import a configuration and stage it                  |
  | `notifications.alerting.grafana.app/alertmanagerimports:get`    | View a staged configuration                          |
  | `notifications.alerting.grafana.app/alertmanagerimports:delete` | Revert a staged configuration, and promote one       |
  | `alert.notifications.receivers:create`                          | Promote the contact points in a staged configuration |
  | `notifications.alerting.grafana.app/routingtrees:create`        | Promote the notification policy tree                 |

  The legacy `alert.notifications:write` permission also grants all of the preceding actions.

## Import an Alertmanager configuration

The wizard always stages what it imports. It never writes to your live Alertmanager, so you can review the result before you promote it.

To import notification configuration through the Grafana Alerting user interface, complete the following steps.

1. Go to **Alerting** > **Settings** and click the **Import** tab.

1. Click **Import Alertmanager configuration**.

   If a configuration is already staged, promote or revert it first.

1. On the **Notification resources** step, choose an **Import source**:
   - **YAML file**: Upload your Alertmanager configuration YAML file. You can also upload the template files your configuration references. Grafana imports each file as a template named after the file, so filenames must be unique.
   - **Data source**: Select an Alertmanager data source. Grafana reads the configuration from it.

1. Enter a **Policy tree name**.

   This is the identifier for the import. Grafana creates a separate notification policy tree with this name rather than merging routes into your default policy. Selecting a data source pre-fills this field with the data source name.

   Grafana validates the configuration as you fill in this step and reports conflicts before you continue.

1. Click **Alert rules**.

   The **Alert rules** step imports alert rules and recording rules. For details, refer to [import data source-managed rules to Grafana-managed rules](ref:import-rules). To import notification configuration only, click **Skip this step**.

1. On the **Review & import** step, check the summary and click **Start import**.

   Each section shows what happens to it, for example **Will import this configuration** or **Skipped**.

1. In **Confirm Import**, click **Start Import**.

Grafana stages the configuration and returns you to the **Import** tab, where you can review it. If you skipped the notification resources step and imported only alert rules, you land on the alert rule list instead.

The wizard's navigation buttons are named after the step they open rather than **Next** and **Back**.

## Review a staged configuration

The **Import** tab shows the staged configuration as a card titled with its identifier and badged **Staged · read-only**.

Expand **Resources** to see what the import contains, grouped by type with a count for each:

- **Contact points**, with their integration types
- **Notification policy**, showing the imported policy tree and its child routes with their matchers and target contact points
- **Templates**
- **Time intervals**
- **Inhibition rules**, showing source and target matchers inline

Each row has a **View** link that opens the resource in its usual management page, in read-only form.

## Promote a staged configuration

Promoting merges the staged resources into your live Grafana Alertmanager and turns them into normal, editable Grafana resources. Grafana then removes the staged copy, which frees the slot for another import.

{{< admonition type="caution" >}}
Promoting can't be undone. To reverse it, you have to delete each resulting resource by hand.
{{< /admonition >}}

1. On the **Import** tab, click **Promote to live config**.

1. Review the preview.

   Grafana validates the merge and shows what changes under **Will merge into your live config**. The preview counts the contact points, templates, time intervals, inhibition rules, and notification routes that it adds.

   Grafana renames any imported resource whose name already exists in your live configuration. The **Renamed to avoid conflicts** section lists both the original name and the replacement.

1. Click **Promote to live config**.

Alert rules aren't part of a promote. Rules imported through the wizard are already active as Grafana-managed rules, so promoting only merges the Alertmanager resources.

### How the merge resolves conflicts

Grafana applies the following rules when it merges a staged configuration into your live one:

- **Name collisions**: Grafana renames the incoming resource rather than overwriting yours. It appends `_` and the import identifier to the name, for example `oncall_prometheus-prod`. If that name is also taken, it adds a numbered suffix, such as `_01`. It then updates every reference to the renamed resource.
- **Policy tree placement**: Grafana inserts the imported routing tree as the first route under your live root route, rather than merging it in. It sets `group_wait`, `group_interval`, and `repeat_interval` explicitly on that route so it doesn't inherit unintended defaults from the parent.
- **Inhibition rules**: Grafana copies them into your live configuration unchanged.
- **Tree name conflicts**: The merge fails if a policy tree with the import identifier already exists. It also fails if the identifier matches the default tree name.

## Revert a staged configuration

Reverting discards the staged copy. It's a safe operation:

- Your live Alertmanager configuration isn't affected.
- Anything you already promoted stays in place.
- You can import the same configuration again later.

To revert, click **Revert** on the staged configuration card, then confirm.

## Import with auto-sync

Auto-sync keeps an imported configuration up to date instead of importing it once. It reads from a Mimir or Cortex Alertmanager data source and writes to the same staged slot a manual import uses, so the synced resources stay read-only.

You configure auto-sync on the **Import** tab rather than in the wizard. The **Auto-sync configuration** card appears only when the `alerting.syncExternalAlertmanager` feature toggle is enabled.

To turn auto-sync on, select a **Datasource** and click **Save**. The card badge changes from **Not configured** to **Active**. To turn it off, click **Disable sync** and confirm.

If the `external_alertmanager_uid` key in the `[unified_alerting]` section of `grafana.ini` sets the data source, the card shows a **Managed by operator** badge and you can't change the picker. Change the key and restart Grafana, or remove it to manage auto-sync from the UI.

When auto-sync writes the staged configuration, the card shows a **Synced · read-only** badge. Grafana hides the **Revert** button, because the next sync would recreate the copy. To remove the configuration, disable auto-sync instead.

You can still promote a synced configuration. Promoting stops the resources from tracking the data source and turns auto-sync off.

Auto-sync and the wizard compete for the same slot, so only one of them can hold a configuration at a time:

- While auto-sync is active, the wizard won't import notification resources. It shows an **Auto-sync is enabled** warning and points you to Alerting settings to disable sync first. You can still import alert rules.
- While a manually staged configuration occupies the slot, auto-sync can't start. The card reports **Auto-sync is unavailable while a configuration is staged** and names the identifier holding it. Promote or revert that configuration to free the slot.

## Import with the API

You can stage, promote, and revert configurations with the convert API instead of the wizard. Its endpoints are available when the `alertingImportAlertmanagerAPI` feature toggle is enabled.

For the endpoints, the request body, and the headers that name a configuration or turn a stage into a promote, refer to [Convert API](ref:convert-api).

## Next steps

- [Configure Alertmanagers](ref:configure-alertmanager)
- [Import data source-managed rules to Grafana-managed rules](ref:import-rules)
- [Manage contact points](ref:contact-points)
- [Configure notification policies](ref:notification-policies)
- [Configure notification templates](ref:templates)
- [Configure mute timings and active time intervals](ref:time-intervals)
- [Configure inhibition rules](ref:inhibition-rules)
