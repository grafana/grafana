---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/import-alertmanager-configuration/
description: Import an existing Prometheus or Mimir Alertmanager configuration into Grafana Alerting and operate it as Grafana-managed notification resources.
keywords:
  - grafana
  - alerting
  - alertmanager
  - import
  - notifications
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Import Alertmanager configuration
title: Import Alertmanager configuration to Grafana-managed notifications
weight: 460
refs:
  import-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alerting-migration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/alerting-migration/
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
  configure-notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-notification-policy/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-notification-policy/
  notification-policy-trees:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-notification-policy/#manage-multiple-notification-policies
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-notification-policy/#manage-multiple-notification-policies
  configure-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
  configure-mute-timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings/
  images-in-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/images-in-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/images-in-notifications/
  configure-inhibition-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/inhibition-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/inhibition-rules/
  rbac:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
  feature-toggles:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/
---

# Import Alertmanager configuration to Grafana-managed notifications

You can import an existing Prometheus or Mimir Alertmanager configuration into Grafana Alerting. Grafana stores the configuration as-is and evaluates it the way your Alertmanager does. It then surfaces the configuration as Grafana notification resources: contact points, a notification policy tree, notification templates, time intervals, and inhibition rules. You operate your notification setup from Grafana.

Importing is a safe operation. The source Alertmanager keeps its configuration, and Grafana never writes back to it.

The import happens in two stages:

- **Stage**: Grafana keeps the imported configuration as a unit of its own and combines it with your Grafana resources at runtime.
- **Promote**: Grafana merges the imported configuration permanently into your Grafana configuration. Every imported resource becomes a normal, editable Grafana resource, and you can no longer revert the import in one action.

Holding a staged configuration apart is what lets you revert or re-import all of it at once, instead of resource by resource. Its resources are read-only, and no Grafana resource can reference them. The imported policy tree is the exception: an alert rule can route to it by name. Until a rule does, your existing notifications are unchanged.

{{< admonition type="note" >}}
Importing Alertmanager configuration is in [public preview](https://grafana.com/docs/release-life-cycle/#public-preview). The API is behind the `alertingImportAlertmanagerAPI` [feature toggle](ref:feature-toggles) and the user interface is behind `alertingMigrationWizardUI`. Both are disabled by default. In Grafana Cloud, contact Support to enable them.
{{< /admonition >}}

## Before you begin

Before you import an Alertmanager configuration, make sure you have the following:

- **A source Grafana can read**: A configuration YAML file with its template files, or a configured Mimir Alertmanager data source. Upstream Prometheus Alertmanager data sources aren't supported.
- **Permissions**: Importing a configuration requires the `alert.notifications:write` permission, or the scoped Alertmanager imports permissions. Both are granted to the Admin role by default. Promoting an import additionally requires create permissions for each resource type in the configuration: contact points, notification policies, notification templates, time intervals, and inhibition rules. For more details, refer to [RBAC permissions](ref:rbac).

Not every Alertmanager configuration can be imported as it is. Refer to [limitations](#limitations) before you start.

## How it works

Grafana imports the configuration as it is and evaluates it the way your source Alertmanager does. Receivers keep their Alertmanager fields, and they notify with the same logic and message format, because Grafana runs them as Mimir-compatible integrations instead of rewriting them into native Grafana ones.

Mimir-compatible integrations don't offer what a native Grafana integration adds on top, such as [images in notifications](ref:images-in-notifications). To pick those up, promote the import and then rebuild the contact point as a Grafana one.

### What gets imported

Grafana imports every field of the configuration: receivers, the routing tree, template files, time intervals, and inhibition rules. Fields keep their names and values, apart from the renames described in [name conflicts](#name-conflicts). Both `time_intervals` and the deprecated `mute_time_intervals` become time intervals.

The `global` section is the one part with no place of its own. Grafana resolves its values into the settings of each integration that relies on them as the configuration is parsed, so the defaults you set globally still apply.

### Routing

Grafana adds the imported routing tree as a named policy tree of its own, alongside your default notification policy. Alerts reach it only when an alert rule routes to it by name. The matchers inside the imported tree then sort those alerts the way they did in your source Alertmanager. For more details on serving more than one policy tree, refer to [manage multiple notification policies](ref:notification-policy-trees).

If the imported root route leaves `group_wait`, `group_interval`, or `repeat_interval` unset, Grafana fills in the Alertmanager defaults: 30 seconds, 5 minutes, and 4 hours. The imported tree keeps its own timing instead of inheriting it from your Grafana root policy.

You choose the tree name when you import. This name is also the identifier of the import, so pick something you recognize, such as `prometheus-prod`. The name has to be a valid DNS subdomain name and is length-limited; for more details, refer to [limitations](#limitations).

### Name conflicts

Contact points, time intervals, and notification templates are identified by name, and the imported configuration may reuse names that already exist. Rather than fail or overwrite, Grafana renames the incoming resource:

1. Grafana appends `_` and the import identifier to the name, for example `default` becomes `default_prometheus-prod`.
1. If that name is also taken, Grafana appends a number, for example `default_prometheus-prod_01`.

All references to a renamed resource are updated throughout the imported configuration, so routing still points at the right contact point.

Templates count conflicts differently. An imported template never conflicts with a Grafana-managed template of the same name, only with a template from another imported configuration. For more details, refer to [limitations](#limitations).

### Staged resources are read-only

While an import is staged, its resources appear with an **Imported** status in the Grafana Alerting user interface and in the notification APIs, and you can't edit or delete them individually. The deprecated provisioning API is the exception: it doesn't return them at all.

You also can't reference an imported resource from a Grafana resource. For example, you can't pick an imported contact point in a Grafana notification policy. The imported policy tree is the exception: an alert rule can route to it by name while the import is staged.

To make imported resources editable and available for reference, promote the import.

### One import at a time

Grafana stores one imported configuration per organization. Importing a second configuration with a different identifier fails unless you explicitly replace the existing one.

## Import with the Grafana Alerting user interface

The Grafana Alerting user interface imports notification resources and alert rules in one flow. It requires both the `alertingImportAlertmanagerAPI` and `alertingMigrationWizardUI` [feature toggles](ref:feature-toggles).

1. Go to **Alerting** > **Alert rules**.
1. In the **More** menu, click **Import to Grafana Alerting**.
1. Choose how the resources are added:
   - **Stage** brings the configuration in as a read-only, reversible copy.
   - **Promote** merges the configuration into your live configuration immediately. This can't be undone. To reverse it you have to delete each resulting resource by hand.
1. Click **Next**.
1. On the **Import notification resources** step, choose the **Import source**:
   - **Alertmanager config YAML** uploads a configuration file. Optionally, upload the template files the configuration references. Each file is imported as a template named after the file.
   - **Alertmanager data source** reads the configuration from a configured Alertmanager data source.
1. Enter a **Policy tree name**.

   Grafana validates the configuration as you fill in the form and reports any conflicts. The form lists the resources that Grafana renames before you import.

1. Click **Next**, and either configure the [alert rules import](ref:import-rules) or skip the step.
1. Review the summary, then click **Start import**.

## Import with the API

The Alertmanager import endpoints are compatible with the [Mimir Alertmanager HTTP API](/docs/mimir/latest/references/http-api/#alertmanager), so you can use `mimirtool` or plain HTTP requests.

In these endpoints, an import is addressed by its identifier, which is set with the `X-Grafana-Alerting-Config-Identifier` header and defaults to `imported`.

| Method | Endpoint                                      | Summary                                                                            |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| POST   | `/convert/api/v1/alerts`                      | Import an Alertmanager configuration, optionally promoting it in the same request. |
| GET    | `/convert/api/v1/alerts`                      | Get the staged configuration. Secrets are masked.                                  |
| DELETE | `/convert/api/v1/alerts`                      | Delete the staged configuration. The Grafana configuration is unaffected.          |
| POST   | `/convert/api/v1/alerts/{Identifier}/promote` | Promote a staged configuration into the Grafana configuration.                     |

The `POST` endpoint accepts YAML and JSON. If no media type is specified, YAML is assumed. The request body has the same shape as the Mimir Alertmanager configuration API:

```yaml
template_files:
  default.tmpl: '{{ define "custom" }}Custom message{{ end }}'
alertmanager_config: |
  route:
    receiver: webhook
  receivers:
    - name: webhook
      webhook_configs:
        - url: 'https://example.com/webhook'
```

A successful import returns the merge result, including any renamed resources:

```json
{
  "status": "success",
  "stats": {
    "addedRoute": "prometheus-prod",
    "addedReceivers": ["webhook", "default_prometheus-prod"],
    "addedTemplates": ["default.tmpl"]
  },
  "renameResources": {
    "receivers": { "default": "default_prometheus-prod" }
  }
}
```

### Optional headers

Use these headers for more granular import control:

#### `X-Grafana-Alerting-Config-Identifier`

The identifier of the import, which is also the name of the notification policy tree it creates. It must be a valid DNS subdomain name of at most 40 characters, using only lowercase alphanumeric characters, `-`, and `.`. Defaults to `imported`.

#### `X-Grafana-Alerting-Dry-Run`

Set to `true` to validate the configuration and report the merge result without saving anything. Use this to preview renames before importing.

#### `X-Grafana-Alerting-Promote`

Set to `true` to promote the configuration in the same request instead of staging it. Combine it with `X-Grafana-Alerting-Dry-Run` to preview what a promotion merges into the live configuration.

#### `X-Grafana-Alerting-Config-Force-Replace`

Set to `true` to replace an existing staged configuration that has a different identifier. Without it, importing a second configuration fails.

### `mimirtool`

Use `mimirtool alertmanager load` to import a configuration and its template files:

```bash
MIMIR_ADDRESS=<GRAFANA_BASE_URL>/api/convert/ \
MIMIR_AUTH_TOKEN=<SERVICE_ACCOUNT_TOKEN> \
MIMIR_TENANT_ID=1 \
mimirtool alertmanager load alertmanager.yaml default.tmpl \
  --extra-headers "X-Grafana-Alerting-Config-Identifier=prometheus-prod"
```

Replace the following placeholders:

- `<GRAFANA_BASE_URL>`: The base URL of your Grafana instance.
- `<SERVICE_ACCOUNT_TOKEN>`: A service account token with permission to import notification resources.

When the address points at `<GRAFANA_BASE_URL>/api/convert/`, `mimirtool` talks to Grafana rather than to a Mimir instance, so `MIMIR_TENANT_ID` must always be `1`.

`mimirtool alertmanager get` and `mimirtool alertmanager delete` read and remove the staged configuration in the same way.

### Promote a staged configuration

To promote a configuration that's already staged, call the promote endpoint with its identifier:

```bash
curl -X POST \
  -H "Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>" \
  <GRAFANA_BASE_URL>/api/convert/api/v1/alerts/prometheus-prod/promote
```

After promotion, the staged configuration no longer exists. Its resources are part of the Grafana configuration. You can edit them through the regular notification APIs and user interface.

## Review, promote, or revert a staged configuration

Staged configurations are managed in Grafana Alerting settings.

1. Go to **Alerting** > **Settings**.
1. Click the **Import** tab.

The **Staged configuration** section lists the contact points, notification policies, templates, time intervals, and inhibition rules the import contains, and links to each resource so you can inspect it before promoting.

To discard the import and everything it added, click **Revert**. Your Grafana configuration is unaffected.

{{< admonition type="warning" >}}
Reverting deletes the imported notification policy tree. Alert rules that route to that tree lose their target, and their alerts fall back to the root of your default notification policy. Repoint those rules before you revert.
{{< /admonition >}}

## Limitations

Consider the following when you import an Alertmanager configuration:

- **Unsupported receiver fields**: An integration field that reads its value from elsewhere, which includes every `*_file` and `*_ref` variant. Has no equivalent in Grafana. Grafana rejects a configuration that contains one, so nothing is imported. Supply the value inline in the matching field instead, and drop the `_file` or `_ref` variant.
- **Data source support**: Grafana reads a configuration from a Mimir Alertmanager data source. Upstream Prometheus Alertmanager doesn't expose a configuration API, so those data sources aren't supported. Import a configuration YAML file instead.
- **Global settings**: After you promote an import, the `global` section no longer exists as a section of its own. Grafana has resolved its values into each integration setting that relies on them, so a promoted contact point carries the resolved value rather than a reference to `global`.
- **Policy tree name**: The name of the imported policy tree, which is also the import identifier, must be a valid DNS subdomain name of at most 40 characters, using only lowercase alphanumeric characters, `-`, and `.`.
- **One staged configuration at a time**: Grafana stores one staged configuration per organization. Importing a second configuration with a different identifier fails unless you explicitly replace the existing one.
- **Template name conflicts across imports**: Grafana renames colliding template files, but the templates defined inside those files share one namespace. Say an earlier import defines a template called `default.email` that renders `X`, and a new import defines `default.email` again, in a file under a different name, rendering `Y`. Which definition wins isn't deterministic, and every contact point that uses that name gets the winner—so contact points from the earlier import can start sending the wrong content. Check the names of the templates you define, not just the file names, before you import a second configuration.
- **Deprecated provisioning API**: A staged configuration isn't visible in the deprecated provisioning API, which doesn't return its contact points, templates, or time intervals. Use the Grafana Alerting notification API (`notifications.alerting.grafana.app`) instead.
- **Inhibition rules**: Imported inhibition rules are supported through the API only. There's no user interface for creating or editing them. For more details, refer to [configure inhibition rules](ref:configure-inhibition-rules).

## Next steps

After you import your notification configuration:

- [Import your data source-managed alert rules](ref:import-rules) and route them through the imported policy tree.
- Review the imported [contact points](ref:configure-contact-points), [notification policies](ref:configure-notification-policies), [templates](ref:configure-templates), and [time intervals](ref:configure-mute-timings).
