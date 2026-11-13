---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/gcx-provisioning/
description: Use the gcx CLI to export, version, and provision alerting resources
keywords:
  - grafana
  - alerting
  - alerting resources
  - provisioning
  - gcx
  - CLI
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Use gcx to manage alerting resources
weight: 400
---

# Use gcx to manage alerting resources

[gcx](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/) is a command-line tool (CLI) for you and coding agents to manage Grafana resources. You can use it to save alerting resources to files, keep them in version control, and push them to the same or another Grafana instance.

`gcx` provides two ways to manage alerting resources:

- [`gcx resources`](#manage-resources-with-gcx-resources) to export and provision alerting resources as manifest files.

- [`gcx alert` commands](#manage-resources-with-gcx-alert) to export and manage alerting resources.

## Before you begin

1. [Install `gcx`](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/).

1. [Authenticate `gcx`](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/) with the preferred method for your Grafana instance.

1. To check which configuration `gcx` uses, run:

   ```bash
   gcx config view
   ```

## Manage resources with `gcx resources`

Use `gcx resources` to export and provision alerting resources.

Use `pull` to export existing alert rules to a local directory:

```bash
gcx resources pull alertrules --path ./alerting/
# ✔ 3 resources pulled, 0 errors
```

By default, `gcx resources pull` writes JSON and names each file after `metadata.name`.

Use `push` to provision the alert rules saved into the directory.

```bash
gcx resources push alertrules --path ./alerting/
# ✔ 3 resources pushed, 0 errors
```

To push one resource, add its `metadata.name` to the selector:

```bash
gcx resources push alertrules/<RULE_ID> --path ./alerting/
# ✔ 1 resources pushed, 0 errors
```

{{< admonition type="note" >}}

Pushing an existing resource replaces it. You cannot edit the provisioned resource in the Grafana UI.

This prevents UI changes that would be overwritten when the resource is provisioned again. To change the resource, update its manifest file and push it again.

{{< /admonition >}}

### Supported alerting resources

`gcx resources` supports a subset of alerting resource types.

The supported types depend on the API provided by your Grafana version. Resources that include secrets, such as contact points, are currently excluded.

To list the resource types your instance serves, run:

```bash
gcx resources list-types --no-schema -o text | grep alerting | grep -w v1beta1
```

```output
notifications.alerting.grafana.app   v1beta1   routingtrees
notifications.alerting.grafana.app   v1beta1   templategroups
notifications.alerting.grafana.app   v1beta1   timeintervals
rules.alerting.grafana.app           v1beta1   alertrules
rules.alerting.grafana.app           v1beta1   recordingrules
rules.alerting.grafana.app           v1beta1   rulesequences
```

## Manage resources with `gcx alert`

Use `gcx alert` to inspect and manage alerting resources. Each resource type has its own commands.

| Resource                                                                                                                         | Purpose                                                         | Operations                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| [contact-points](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-contact-points)               | Manage contact points                                           | `list`, `get`, `create`, `update`, `delete`, `export` |
| [groups](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-groups)                               | Inspect Grafana-managed alert rule groups (read-only)           | `list`, `get`, `status`                               |
| [instances](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-instances)                         | List alert instances (read-only)                                | `list`                                                |
| [mute-timings](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-mute-timings)                   | Manage mute timings                                             | `list`, `get`, `create`, `update`, `delete`, `export` |
| [notification-history](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-notification-history)   | Inspect delivered alert notifications (read-only)               | `list`, `list-alerts`                                 |
| [notification-policies](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-notification-policies) | Manage the notification policy tree                             | `get`, `set`, `reset`, `export`                       |
| [routing-trees](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-routing-trees)                 | Manage notification routing trees, including the default tree   | `list`, `get`, `create`, `update`, `delete`           |
| [ruler](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-ruler)                                 | Manage data source-managed (Mimir and Loki) rules               | `groups`, `namespaces`                                |
| [rules](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-rules)                                 | Inspect Grafana-managed alert rule state and health (read-only) | `list`, `get`                                         |
| [state-history](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-state-history)                 | Query alert rule state transitions (read-only)                  | `list`                                                |
| [template-groups](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-template-groups)             | Manage native notification template groups                      | `list`, `get`, `create`, `update`, `delete`           |
| [templates](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-templates)                         | Manage notification templates                                   | `list`, `get`, `upsert`, `delete`                     |
| [time-intervals](/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/gcx/cli-reference/#gcx-alert-time-intervals)               | Manage notification time intervals                              | `list`, `get`, `create`, `update`, `delete`           |

{{< admonition type="note" >}}
The `gcx alert` commands are in active development.

Run `gcx alert --help` or `gcx alert <RESOURCE> --help` to see what your version supports.
{{< /admonition >}}

### Export resources for provisioning

Use `export` to save existing resources in the Grafana provisioning format. Choose `yaml`, `json`, or `hcl`:

```bash
gcx alert contact-points export --format yaml > contact-points.yaml
```

Use the `yaml` output with [file provisioning](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning/). Use the `hcl` output with [Terraform](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/).

{{< admonition type="caution" >}}
Contact points can contain credentials.

Grafana exports secure fields as `[REDACTED]`, so exported files don't contain secrets. Replace these placeholders with the required values before provisioning.
{{< /admonition >}}

### Manage resources using CRUD operations

Use the operations available for each resource type to create, read, update, or delete resources. For example, to create and update a contact point:

1. Create a file named `contact-point.yaml`:

   ```yaml
   name: team-webhook
   type: webhook
   settings:
     url: https://example.com/alerts
   ```

1. Create the contact point:

   ```bash
   gcx alert contact-points create --filename contact-point.yaml
   ```

1. Verify that it exists:

   ```bash
   gcx alert contact-points list
   ```

   This command returns the list of contact points with their UID, name, type, and provenance state.

   ```
   ┌──────────────────┬─────────────────┬──────────┬─────────────┐
   │ UID              │ NAME            │ TYPE     │ PROVENANCE  │
   ├────-─────────────┼──────-──────────┼──────────┼─────────────┤
   │ dg40y30b347wgb   │ team-webhook    | webhook  │             │
   └──────-───────────┴─────────────────┴──────────┴─────────────┘
   ```

1. To update the contact point, edit `contact-point.yaml` and run update with its `UID`:

   ```bash
   gcx alert contact-points update <UID> --filename contact-point.yaml
   ```

You can also use `get` to save an existing resource to a file for editing:

```bash
gcx alert contact-points get <UID> -o json > contact-point.json
```

Some operations replace or update existing data:

- `gcx alert notification-policies set` replaces the entire notification policy tree. Export the current tree before you run it.
- `gcx alert templates upsert` creates a template or updates it if a template with the same name exists.

### Disable updates in the Grafana UI

By default, resources written by `gcx alert` are editable in the Grafana UI. Resources provisioned with `gcx resources push` cannot be edited in the UI.

To prevent UI updates so that a resource can only be changed through provisioning, set `--allow-ui-updates=false`:

```bash
gcx alert contact-points create --filename contact-point.yaml --allow-ui-updates=false
```

The `allow-ui-updates` flag is available on the following commands:

- `gcx alert contact-points create` and `update`
- `gcx alert mute-timings create` and `update`
- `gcx alert templates upsert`
- `gcx alert notification-policies set`
