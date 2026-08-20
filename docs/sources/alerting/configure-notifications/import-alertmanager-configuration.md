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
  configure-inhibition-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/inhibition-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/inhibition-rules/
  rbac:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
  service-accounts:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/
  feature-toggles:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/
---

# Import Alertmanager configuration to Grafana-managed notifications

You can import an existing Prometheus or Mimir Alertmanager configuration into Grafana Alerting. Grafana converts the configuration into Grafana-managed notification resources—contact points, a notification policy tree, notification templates, mute timings, and inhibition rules—so you can operate your notification setup from Grafana.

Importing is a safe operation. The source Alertmanager keeps its configuration, and Grafana never writes back to it.

The import happens in two stages, so you can check the result before it affects live notifications:

- **Stage**: Grafana stores the imported configuration next to your Grafana configuration and merges the two at runtime. Imported resources are visible but read-only, and you can revert the whole import in one action.
- **Promote**: Grafana merges the imported configuration permanently into your Grafana configuration. Every imported resource becomes a normal, editable Grafana resource.

{{< admonition type="note" >}}
Importing Alertmanager configuration is in [public preview](https://grafana.com/docs/release-life-cycle/#public-preview). The API is behind the `alertingImportAlertmanagerAPI` [feature toggle](ref:feature-toggles) and the import wizard is behind `alertingMigrationWizardUI`. Both are disabled by default. In Grafana Cloud, contact Support to enable them.
{{< /admonition >}}

## Before you begin

Before you import an Alertmanager configuration, make sure you have the following:

- **An Alertmanager configuration to import**: either a configuration YAML file with its template files, or a configured Alertmanager data source that Grafana can read the configuration from.
- **Permissions**: importing a configuration requires the `alert.notifications:write` permission, or the scoped Alertmanager imports permissions. Promoting an import additionally requires create permissions for each resource type in the configuration: contact points, notification policies, notification templates, mute timings, and inhibition rules. For more details, refer to [RBAC permissions](ref:rbac).
- **A service account token** if you import through the API or `mimirtool`. For more details, refer to [service accounts](ref:service-accounts).

## How it works

Grafana keeps the imported configuration separate from your Grafana configuration until you promote it. Both configurations are merged when alerts are routed, so imported contact points and policies notify as soon as the import completes.

### What each Alertmanager object becomes

Grafana maps the Alertmanager configuration to its own notification resources:

| Alertmanager configuration              | Grafana-managed resource                                               |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `receivers`                             | Contact points                                                         |
| `route`                                 | A separate notification policy tree, named after the import identifier |
| `template_files`                        | Notification templates, one per file, named after the file             |
| `time_intervals`, `mute_time_intervals` | Mute timings and active time intervals                                 |
| `inhibit_rules`                         | Inhibition rules                                                       |
| `global`                                | Not imported                                                           |

### Routing

Grafana doesn't merge the imported routing tree into your default notification policy. It adds the imported tree as a separate, named policy tree, and evaluates it before your existing routes.

The imported root route gets explicit `group_wait`, `group_interval`, and `repeat_interval` values, so its timing doesn't change depending on what your Grafana root policy defines.

You choose the tree name when you import. This name is also the identifier of the import, so pick something you recognize, such as `prometheus-prod`.

### Name conflicts

Contact points and time intervals are identified by name, and the imported configuration may reuse names that already exist in Grafana. Rather than fail or overwrite, Grafana renames the incoming resource:

1. Grafana appends `_` and the import identifier to the name, for example `default` becomes `default_prometheus-prod`.
1. If that name is also taken, Grafana appends a number, for example `_01`.

All references to a renamed resource are updated throughout the imported configuration, so routing still points at the right contact point. Run a dry-run import to see the renames before you commit to them.

### Staged resources are read-only

While an import is staged, its resources appear in the Grafana Alerting user interface with an **Imported** status, and you can't edit or delete them individually. You also can't reference them from Grafana resources—for example, you can't pick an imported contact point in a Grafana notification policy or an alert rule.

Label-based routing still works. Alerts that match the matchers of an imported policy are routed through it, whatever created them.

To make imported resources editable and referenceable, promote the import.

### One import at a time

Grafana stores one imported configuration per organization. Importing a second configuration with a different identifier fails unless you explicitly replace the existing one.

## Import with the Grafana Alerting user interface

The import wizard imports notification resources and alert rules in one flow.

1. Go to **Alerting** > **Alert rules**.
1. In the **More** menu, click **Import to Grafana Alerting**.
1. Choose how the resources are added:
   - **Stage** brings the configuration in as a read-only, reversible copy.
   - **Promote** merges the configuration into your live configuration immediately. This can't be undone—to reverse it you have to delete each resulting resource by hand.
1. Click **Next**.
1. On the **Import notification resources** step, choose the **Import source**:
   - **Alertmanager config YAML** uploads a configuration file. Optionally, upload the template files the configuration references. Each file is imported as a template named after the file.
   - **Alertmanager data source** reads the configuration from a configured Alertmanager data source.
1. Enter a **Policy tree name**.

   Grafana validates the configuration as you fill in the form and reports any conflicts. Resources that would be renamed are listed before you import.

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
    "addedReceivers": ["webhook"],
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

The identifier of the import, which is also the name of the notification policy tree it creates. It must be a valid DNS subdomain name—lowercase alphanumeric characters, `-`, and `.`. Defaults to `imported`.

#### `X-Grafana-Alerting-Dry-Run`

Set to `true` to validate the configuration and report the merge result without saving anything. Use this to preview renames before importing.

#### `X-Grafana-Alerting-Promote`

Set to `true` to promote the configuration in the same request instead of staging it. Combine it with `X-Grafana-Alerting-Dry-Run` to preview what a promotion merges into the live configuration.

#### `X-Grafana-Alerting-Config-Force-Replace`

Set to `true` to replace an existing staged configuration that has a different identifier. Without it, importing a second configuration fails.

### mimirtool

Use `mimirtool alertmanager load` to import a configuration and its template files:

```bash
MIMIR_ADDRESS=<GRAFANA_BASE_URL>/api/convert/ \
MIMIR_AUTH_TOKEN=<SERVICE_ACCOUNT_TOKEN> \
MIMIR_TENANT_ID=1 \
mimirtool alertmanager load alertmanager.yaml default.tmpl \
  --extra-headers "X-Grafana-Alerting-Config-Identifier=prometheus-prod"
```

Replace the following placeholders:

- `<GRAFANA_BASE_URL>`: the base URL of your Grafana instance.
- `<SERVICE_ACCOUNT_TOKEN>`: a service account token with permission to import notification resources.

When the address points at `<GRAFANA_BASE_URL>/api/convert/`, `mimirtool` talks to Grafana rather than to a Mimir instance, so `MIMIR_TENANT_ID` must always be `1`.

`mimirtool alertmanager get` and `mimirtool alertmanager delete` read and remove the staged configuration in the same way.

### Promote a staged configuration

To promote a configuration that's already staged, call the promote endpoint with its identifier:

```bash
curl -X POST \
  -H "Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>" \
  <GRAFANA_BASE_URL>/api/convert/api/v1/alerts/prometheus-prod/promote
```

After promotion, the staged configuration no longer exists—its resources are part of the Grafana configuration and are editable through the regular notification APIs and user interface.

## Review, promote, or revert a staged configuration

Staged configurations are managed in Grafana Alerting settings.

1. Go to **Alerting** > **Settings**.
1. Click the **Import** tab.

The **Staged configuration** section lists the contact points, notification policies, templates, time intervals, and inhibition rules the import contains, and links to each resource so you can inspect it before promoting.

To discard the import and everything it added, click **Revert**. Your Grafana configuration is unaffected.

## Limitations

Consider the following when you import an Alertmanager configuration:

- **Unsupported receiver fields**: fields Grafana can't represent, such as `*_file` settings that read a secret from disk, cause the import to fail rather than being silently dropped. The error lists each unsupported field, such as `email_configs[0].auth_password_file`. Replace them with inline values before importing.
- **Global settings**: the `global` section isn't imported. Configure the equivalent settings on each contact point, or in the Grafana configuration file.
- **Inhibition rules**: imported inhibition rules are supported through the API only. There's no user interface for creating or editing them. For more details, refer to [configure inhibition rules](ref:configure-inhibition-rules).
- **Provisioning**: staged resources can't be provisioned or have permissions assigned to them. Promote the import first.

## Next steps

After you import your notification configuration:

- [Import your data source-managed alert rules](ref:import-rules) and route them through the imported policy tree.
- Review the imported [contact points](ref:configure-contact-points), [notification policies](ref:configure-notification-policies), [templates](ref:configure-templates), and [mute timings](ref:configure-mute-timings).
