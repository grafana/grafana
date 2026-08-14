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

## Import method

The first step of the import wizard asks how you want to bring the resources in. Choose the method that matches your intent.

| Method    | What it does                                                                                                                       | Reversible                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Stage     | Saves a read-only copy for review. Nothing merges into your live configuration until you promote it.                               | Yes. Revert removes the copy.              |
| Promote   | Merges the resources straight into your live configuration as normal, editable Grafana resources.                                  | No. You must delete each resource by hand. |
| Auto-sync | Continuously syncs configuration from a Mimir or Cortex Alertmanager data source. The synced resources stay read-only and tracked. | Yes. Disable sync to stop it.              |

**Auto-sync** appears only when the `alerting.syncExternalAlertmanager` feature toggle is enabled and you hold the Admin organization role. Choosing it collapses the wizard to a single confirmation step, because there's nothing to configure per resource.

As a best practice, choose **Stage** the first time you import from a given source. Review what landed, then promote it.

## Import an Alertmanager configuration

To import notification configuration through the Grafana Alerting user interface, complete the following steps.

1. Go to **Alerting** > **Settings** and click the **Import** tab.

1. Click **Import Alertmanager configuration**.

   If a configuration is already staged, promote or revert it first.

1. On the **Import method** step, select **Stage** or **Promote**, then click **Notification resources**.

   To sync continuously instead of importing once, select **Auto-sync** and refer to [Import with auto-sync](#import-with-auto-sync).

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

1. Click **Start Import** to confirm.

A staged import returns you to the **Import** tab so you can review the staged copy. A promoted import takes you to the alert rule list.

The wizard names each navigation button after the step it takes you to, rather than labeling them **Next** and **Back**.

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

Auto-sync keeps an imported configuration up to date instead of importing it once. It can only read from a Mimir or Cortex Alertmanager data source.

To enable auto-sync, complete the following steps:

1. Go to **Alerting** > **Settings** and click the **Import** tab.

1. Click **Import Alertmanager configuration**.

1. On the **Import method** step, select **Auto-sync**, then select a **Data source**.

   The picker lists only Mimir and Cortex Alertmanager data sources. If you have none, add one and start the wizard again.

1. Click **Review & enable**, then click **Enable auto-sync**.

You can also enable it without the wizard: on the **Import** tab, select a **Datasource** in the **Auto-sync configuration** card and click **Save**. The card shows a **Not configured** or **Active** badge. To stop syncing, click **Disable sync** and confirm.

If auto-sync is set through the `external_alertmanager_uid` key in the `[unified_alerting]` section of the Grafana configuration file, the card is read-only. Change the key and restart Grafana, or remove it to manage auto-sync from the UI.

When auto-sync writes the staged configuration, the card shows a **Synced · read-only** badge. Grafana hides the **Revert** button, because the next sync would recreate the copy. To remove the configuration, disable auto-sync instead.

You can still promote a synced configuration. Promoting merges the resources into your live configuration, stops them from tracking the data source, and turns auto-sync off.

Because Grafana holds one staged configuration at a time, a manually staged import blocks auto-sync from starting: the sync writes to the same slot and every attempt fails. When this happens, the **Auto-sync configuration** card reports that auto-sync is unavailable and names the identifier occupying the slot. Promote or revert that configuration to free it.

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
