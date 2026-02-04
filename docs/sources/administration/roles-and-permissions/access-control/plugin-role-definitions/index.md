---
description: Learn about the RBAC roles available for Grafana Cloud app plugins
labels:
  products:
    - cloud
menuTitle: Plugin role definitions
title: Grafana Cloud app plugin role definitions
weight: 95
refs:
  folder-access-control:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/folder-access-control/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/folder-access-control/
  rbac-for-app-plugins:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-for-app-plugins/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-for-app-plugins/
  manage-rbac-roles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/manage-rbac-roles/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/manage-rbac-roles/
  rbac-fixed-basic-role-definitions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/
---

# Grafana Cloud app plugin role definitions

{{< admonition type="note" >}}
Available in [Grafana Cloud](/docs/grafana-cloud).
{{< /admonition >}}

This page lists the RBAC roles available for Grafana Cloud app plugins. Plugin roles control access to specific plugin features and can be assigned to users, teams, or basic roles.

For general information about how RBAC works with app plugins, refer to [RBAC for app plugins](ref:rbac-for-app-plugins).

{{< admonition type="note" >}}
Third-party plugins can define their own RBAC roles. This page documents roles for Grafana Cloud app plugins only. Refer to the documentation for third-party plugins to learn about their available roles.
{{< /admonition >}}

## Default plugin permissions by basic role

When you assign a user a basic organization role (Viewer, Editor, or Admin), they automatically receive default plugin permissions. The following table summarizes the default access level for each Grafana Cloud plugin.

| Plugin                          | Viewer                                  | Editor                                                      | Admin                                         |
| ------------------------------- | --------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **Adaptive Logs**               | Read exemptions                         | Read exemptions                                             | Admin access                                  |
| **Adaptive Metrics**            | Read recommendations, exemptions        | Read recommendations, exemptions                            | Admin access                                  |
| **Adaptive Traces**             | Read recommendations                    | Read recommendations                                        | Admin access                                  |
| **Application Observability**   | View access                             | View access                                                 | Admin access                                  |
| **Assistant**                   | Chat access, user rules/quickstarts     | + MCP servers, investigations                               | + Tenant-wide settings                        |
| **Cloud Provider**              | Read access                             | Read access                                                 | Provider-specific write access                |
| **Collector**                   | Read access                             | Read access                                                 | Full access                                   |
| **Cost Attributions**           | Read attributions                       | Read attributions                                           | Read attributions                             |
| **Cost Management and Billing** | —                                       | —                                                           | Full access                                   |
| **Frontend Observability**      | Read apps, source maps                  | + Write apps, source maps                                   | + Delete apps                                 |
| **Grafana Auth**                | —                                       | —                                                           | Write access policies                         |
| **IRM**                         | Read all                                | + Write alert groups, schedules, maintenance, user settings | + Write integrations, escalation chains, etc. |
| **k6**                          | Read settings                           | + Write settings                                            | Admin access                                  |
| **Knowledge Graph**             | Read assertions                         | + Write configuration and rules                             | + Full write access                           |
| **Kubernetes Monitoring**       | Read all                                | Read all                                                    | Admin access                                  |
| **Labels**                      | Read labels                             | + Create, edit, delete labels                               | + Full write access                           |
| **Machine Learning**            | Read forecasting, outliers, sift        | + Write forecasting, outliers, sift                         | + Full write access                           |
| **OnCall**                      | Read all                                | + Write alert groups, schedules, maintenance, user settings | + Write integrations, escalation chains, etc. |
| **Private Data Connect**        | —                                       | —                                                           | Full access                                   |
| **SLO**                         | Read SLOs                               | Create, edit, delete SLOs                                   | + Modify org preferences                      |
| **Synthetic Monitoring**        | Read checks, probes, alerts, thresholds | + Create, edit, delete checks, probes, alerts, thresholds   | + Manage access tokens                        |

{{< admonition type="note" >}}
The permissions above are automatically granted based on the user's organization role. You can assign additional plugin-specific roles (listed below) to grant more granular access.
{{< /admonition >}}

## Adaptive Logs plugin

Plugin ID: `grafana-adaptivelogs-app`

| Plugin role                                                 | Description                                       |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `plugins:grafana-adaptivelogs-app:admin`                    | Read/write access to everything in Adaptive Logs  |
| `plugins:grafana-adaptivelogs-app:patterns-editor`          | Read/write access to recommendations and patterns |
| `plugins:grafana-adaptivelogs-app:patterns-reader`          | Read access to recommendations and patterns       |
| `plugins:grafana-adaptivelogs-app:segments-admin`           | Create and manipulate segments                    |
| `plugins:grafana-adaptivelogs-app:expiring-exemptions-user` | Use the expiring exemptions button                |
| `plugins:grafana-adaptivelogs-app:plugin-access`            | Access to the Adaptive Logs plugin                |

## Adaptive Metrics plugin

Plugin ID: `grafana-adaptive-metrics-app`

| Plugin role                                              | Description                                         |
| -------------------------------------------------------- | --------------------------------------------------- |
| `plugins:grafana-adaptive-metrics-app:admin`             | Read/write access to everything in Adaptive Metrics |
| `plugins:grafana-adaptive-metrics-app:rules-editor`      | Read/write access to recommendations and rules      |
| `plugins:grafana-adaptive-metrics-app:rules-reader`      | Read access to recommendations and rules            |
| `plugins:grafana-adaptive-metrics-app:exemptions-editor` | Edit access to recommendation exemptions            |
| `plugins:grafana-adaptive-metrics-app:exemptions-reader` | Read access to recommendation exemptions            |
| `plugins:grafana-adaptive-metrics-app:segments-editor`   | Edit access to segments                             |
| `plugins:grafana-adaptive-metrics-app:segments-reader`   | Read access to segments                             |
| `plugins:grafana-adaptive-metrics-app:config-editor`     | Edit access to plugin configuration                 |
| `plugins:grafana-adaptive-metrics-app:config-reader`     | Read access to plugin configuration                 |
| `plugins:grafana-adaptive-metrics-app:plugin-access`     | Access to the Adaptive Metrics plugin               |

## Adaptive Traces plugin

Plugin ID: `grafana-adaptivetraces-app`

| Plugin role                                | Description                                        |
| ------------------------------------------ | -------------------------------------------------- |
| `plugins:grafana-adaptivetraces-app:admin` | Read/write access to everything in Adaptive Traces |

## Application Observability plugin

Plugin ID: `grafana-app-observability-app`

| Plugin role                                    | Description                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `plugins:grafana-app-observability-app:admin`  | Read/write access to everything in Application Observability plugin |
| `plugins:grafana-app-observability-app:viewer` | View access in Application Observability plugin                     |

## Cloud Provider plugin

Plugin ID: `grafana-csp-app`

| Plugin role                            | Description                                         |
| -------------------------------------- | --------------------------------------------------- |
| `plugins:grafana-csp-app:aws-writer`   | Read/Write access to AWS in Cloud provider plugin   |
| `plugins:grafana-csp-app:azure-writer` | Read/Write access to Azure in Cloud provider plugin |
| `plugins:grafana-csp-app:gcp-writer`   | Read/Write access to GCP in Cloud provider plugin   |
| `plugins:grafana-csp-app:reader`       | Read access in Cloud provider plugin                |

## Collector App

Plugin ID: `grafana-collector-app`

| Plugin role                                          | Description                               |
| ---------------------------------------------------- | ----------------------------------------- |
| `plugins:grafana-collector-app:collector-app-admin`  | Full access to the Collector App          |
| `plugins:grafana-collector-app:collector-app-reader` | Read-only access to Grafana Collector App |

## Cost Attributions plugin

Plugin ID: `grafana-attributions-app`

| Plugin role                                                 | Description                                         |
| ----------------------------------------------------------- | --------------------------------------------------- |
| `plugins:grafana-attributions-app:cost-attributions-viewer` | View the Cost Attributions application and its data |

## Cost Management and Billing plugin

Plugin ID: `grafana-cmab-app`

| Plugin role                                         | Description                                      |
| --------------------------------------------------- | ------------------------------------------------ |
| `plugins:grafana-cmab-app:full-admin`               | Full access to all features                      |
| `plugins:grafana-cmab-app:billing-and-usage-reader` | Read-only access to billing and usage data       |
| `plugins:grafana-cmab-app:invoice-reader`           | Read-only access to invoices, FOCUS & usage data |
| `plugins:grafana-cmab-app:cost-attribution-admin`   | Full access to cost attributions                 |
| `plugins:grafana-cmab-app:cost-attribution-reader`  | Read-only access to cost attributions            |
| `plugins:grafana-cmab-app:usage-alerts-admin`       | Full access to usage alerts                      |
| `plugins:grafana-cmab-app:usage-alerts-reader`      | Read-only access to usage alerts                 |

## Easystart / Integrations plugin

Plugin ID: `grafana-easystart-app`

| Plugin role                                         | Description             |
| --------------------------------------------------- | ----------------------- |
| `plugins:grafana-easystart-app:integrations-writer` | Administer integrations |

## Frontend Observability plugin

Plugin ID: `grafana-kowalski-app`

| Plugin role                                                              | Description                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `plugins:grafana-kowalski-app:frontend-observability-admin`              | Read/write access to everything in Frontend Observability plugin    |
| `plugins:grafana-kowalski-app:frontend-observability-editor`             | Read/write access to everything but app deletion                    |
| `plugins:grafana-kowalski-app:frontend-observability-viewer`             | View access only                                                    |
| `plugins:grafana-kowalski-app:frontend-observability-sourcemap-uploader` | View access with the ability to read settings and upload sourcemaps |

## Grafana Assistant plugin

Plugin ID: `grafana-assistant-app`

| Plugin role                                                  | Description                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `plugins:grafana-assistant-app:assistant-admin`              | Manage both user and tenant-wide Assistant resources and settings |
| `plugins:grafana-assistant-app:assistant-mcp-user`           | Use Grafana Assistant and add personal MCP servers                |
| `plugins:grafana-assistant-app:assistant-user`               | Basic access to Grafana Assistant with read-only capabilities     |
| `plugins:grafana-assistant-app:assistant-investigation-user` | Use Assistant Backend Investigations                              |

## Grafana Auth plugin

Plugin ID: `grafana-auth-app`

| Plugin role                       | Description                                        |
| --------------------------------- | -------------------------------------------------- |
| `plugins:grafana-auth-app:writer` | Write and manage access policies for Grafana Cloud |

## Incident plugin

Plugin ID: `grafana-incident-app`

| Plugin role                                    | Description                |
| ---------------------------------------------- | -------------------------- |
| `plugins:grafana-incident-app:incident-access` | Access to Grafana Incident |

## IRM plugin

Plugin ID: `grafana-irm-app`

### Core roles

| Plugin role                                      | Description                                                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins:grafana-irm-app:admin`                  | Read/write access to everything in IRM                                                                                                                                                                |
| `plugins:grafana-irm-app:editor`                 | Similar to Admin, minus abilities to: create Integrations, create Escalation Chains, create Outgoing Webhooks, update ChatOps settings, update other user's settings, and update general IRM settings |
| `plugins:grafana-irm-app:reader`                 | Read-only access to everything in IRM                                                                                                                                                                 |
| `plugins:grafana-irm-app:oncaller`               | Read access to everything in IRM, plus edit access to Alert Groups, Schedules, and own settings                                                                                                       |
| `plugins:grafana-irm-app:notifications-receiver` | Receive alert notifications, plus edit own IRM settings                                                                                                                                               |
| `plugins:grafana-irm-app:incident-access`        | Access to Grafana IRM incidents                                                                                                                                                                       |

### Alert groups

| Plugin role                                          | Description                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `plugins:grafana-irm-app:alert-groups-reader`        | Read-only access to Alert Groups                                                         |
| `plugins:grafana-irm-app:alert-groups-editor`        | Read access to Alert Groups + ability to act on Alert Groups (acknowledge, resolve, etc) |
| `plugins:grafana-irm-app:alert-groups-direct-paging` | Manually create new Alert Groups (Direct Paging)                                         |

### Integrations

| Plugin role                                   | Description                       |
| --------------------------------------------- | --------------------------------- |
| `plugins:grafana-irm-app:integrations-reader` | Read-only access to Integrations  |
| `plugins:grafana-irm-app:integrations-editor` | Read/write access to Integrations |

### Escalation chains

| Plugin role                                        | Description                            |
| -------------------------------------------------- | -------------------------------------- |
| `plugins:grafana-irm-app:escalation-chains-reader` | Read-only access to Escalation Chains  |
| `plugins:grafana-irm-app:escalation-chains-editor` | Read/write access to Escalation Chains |

### Schedules

| Plugin role                                | Description                    |
| ------------------------------------------ | ------------------------------ |
| `plugins:grafana-irm-app:schedules-reader` | Read-only access to Schedules  |
| `plugins:grafana-irm-app:schedules-editor` | Read/write access to Schedules |

### ChatOps

| Plugin role                              | Description                           |
| ---------------------------------------- | ------------------------------------- |
| `plugins:grafana-irm-app:chatops-reader` | Read-only access to ChatOps settings  |
| `plugins:grafana-irm-app:chatops-editor` | Read/write access to ChatOps settings |

### Outgoing webhooks

| Plugin role                                        | Description                            |
| -------------------------------------------------- | -------------------------------------- |
| `plugins:grafana-irm-app:outgoing-webhooks-reader` | Read-only access to Outgoing Webhooks  |
| `plugins:grafana-irm-app:outgoing-webhooks-editor` | Read/write access to Outgoing Webhooks |

### Maintenance

| Plugin role                                  | Description                                  |
| -------------------------------------------- | -------------------------------------------- |
| `plugins:grafana-irm-app:maintenance-reader` | Read-only access to Integration Maintenance  |
| `plugins:grafana-irm-app:maintenance-editor` | Read/write access to Integration Maintenance |

### API keys

| Plugin role                               | Description                                                       |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `plugins:grafana-irm-app:api-keys-reader` | Read-only access to OnCall API Keys                               |
| `plugins:grafana-irm-app:api-keys-editor` | Read/write access to OnCall API Keys + ability to consume the API |

### User settings

| Plugin role                                    | Description                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `plugins:grafana-irm-app:user-settings-reader` | Read-only access to own IRM User Settings                                          |
| `plugins:grafana-irm-app:user-settings-editor` | Read/write access to own IRM User Settings + view basic info about other IRM users |
| `plugins:grafana-irm-app:user-settings-admin`  | Read/write access to your own + other's IRM User Settings                          |

### Notification and general settings

| Plugin role                                            | Description                                    |
| ------------------------------------------------------ | ---------------------------------------------- |
| `plugins:grafana-irm-app:notification-settings-reader` | Read-only access to IRM Notification Settings  |
| `plugins:grafana-irm-app:notification-settings-editor` | Read/write access to IRM Notification Settings |
| `plugins:grafana-irm-app:settings-reader`              | Read-only access to IRM Settings               |
| `plugins:grafana-irm-app:settings-editor`              | Read/write access to IRM Settings              |

## k6 Cloud plugin

Plugin ID: `k6-app`

| Plugin role             | Description                                 |
| ----------------------- | ------------------------------------------- |
| `plugins:k6-app:admin`  | Admin access to everything in k6            |
| `plugins:k6-app:editor` | Read/write access to k6 with limited scopes |
| `plugins:k6-app:reader` | Read-only access to k6                      |

## Knowledge Graph plugin

Plugin ID: `grafana-asserts-app`

| Plugin role                                          | Description                                       |
| ---------------------------------------------------- | ------------------------------------------------- |
| `plugins:grafana-asserts-app:knowledge-graph-writer` | Read/write/create in Knowledge Graph              |
| `plugins:grafana-asserts-app:knowledge-graph-reader` | Read-only access to everything in Knowledge Graph |
| `plugins:grafana-asserts-app:knowledge-graph-access` | Access to Knowledge Graph                         |

## Kubernetes Monitoring plugin

Plugin ID: `grafana-k8s-app`

| Plugin role                      | Description                              |
| -------------------------------- | ---------------------------------------- |
| `plugins:grafana-k8s-app:admin`  | Admin access to everything in k8s plugin |
| `plugins:grafana-k8s-app:reader` | Read-only access to k8s plugin           |

## Labels plugin

Plugin ID: `grafana-labels-app`

| Plugin role                                | Description                     |
| ------------------------------------------ | ------------------------------- |
| `plugins:grafana-labels-app:labels-writer` | Read/write/create/delete Labels |
| `plugins:grafana-labels-app:labels-reader` | Read-only access to Labels      |

## Machine Learning plugin

Plugin ID: `grafana-ml-app`

| Plugin role                          | Description                            |
| ------------------------------------ | -------------------------------------- |
| `plugins:grafana-ml-app:ml-editor`   | Read and write access to ML features   |
| `plugins:grafana-ml-app:ml-viewer`   | Read access to ML features             |
| `plugins:grafana-ml-app:sift-editor` | Read and write access to Sift features |
| `plugins:grafana-ml-app:sift-viewer` | Read access to Sift features           |

## OnCall plugin

Plugin ID: `grafana-oncall-app`

### Core roles

| Plugin role                                         | Description                                                                                                                                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins:grafana-oncall-app:admin`                  | Read/write access to everything in OnCall                                                                                                                                                                |
| `plugins:grafana-oncall-app:editor`                 | Similar to Admin, minus abilities to: create Integrations, create Escalation Chains, create Outgoing Webhooks, update ChatOps settings, update other user's settings, and update general OnCall settings |
| `plugins:grafana-oncall-app:reader`                 | Read-only access to everything in OnCall                                                                                                                                                                 |
| `plugins:grafana-oncall-app:oncaller`               | Read access to everything in OnCall, plus edit access to Alert Groups, Schedules, and own settings                                                                                                       |
| `plugins:grafana-oncall-app:notifications-receiver` | Receive OnCall alert notifications, plus edit own OnCall settings                                                                                                                                        |

### Alert groups

| Plugin role                                             | Description                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `plugins:grafana-oncall-app:alert-groups-reader`        | Read-only access to OnCall Alert Groups                                                         |
| `plugins:grafana-oncall-app:alert-groups-editor`        | Read access to OnCall Alert Groups + ability to act on Alert Groups (acknowledge, resolve, etc) |
| `plugins:grafana-oncall-app:alert-groups-direct-paging` | Manually create new Alert Groups (Direct Paging)                                                |

### Integrations

| Plugin role                                      | Description                              |
| ------------------------------------------------ | ---------------------------------------- |
| `plugins:grafana-oncall-app:integrations-reader` | Read-only access to OnCall Integrations  |
| `plugins:grafana-oncall-app:integrations-editor` | Read/write access to OnCall Integrations |

### Escalation chains

| Plugin role                                           | Description                                   |
| ----------------------------------------------------- | --------------------------------------------- |
| `plugins:grafana-oncall-app:escalation-chains-reader` | Read-only access to OnCall Escalation Chains  |
| `plugins:grafana-oncall-app:escalation-chains-editor` | Read/write access to OnCall Escalation Chains |

### Schedules

| Plugin role                                   | Description                           |
| --------------------------------------------- | ------------------------------------- |
| `plugins:grafana-oncall-app:schedules-reader` | Read-only access to OnCall Schedules  |
| `plugins:grafana-oncall-app:schedules-editor` | Read/write access to OnCall Schedules |

### ChatOps

| Plugin role                                 | Description                         |
| ------------------------------------------- | ----------------------------------- |
| `plugins:grafana-oncall-app:chatops-reader` | Read-only access to OnCall ChatOps  |
| `plugins:grafana-oncall-app:chatops-editor` | Read/write access to OnCall ChatOps |

### Outgoing webhooks

| Plugin role                                           | Description                                   |
| ----------------------------------------------------- | --------------------------------------------- |
| `plugins:grafana-oncall-app:outgoing-webhooks-reader` | Read-only access to OnCall Outgoing Webhooks  |
| `plugins:grafana-oncall-app:outgoing-webhooks-editor` | Read/write access to OnCall Outgoing Webhooks |

### Maintenance

| Plugin role                                     | Description                             |
| ----------------------------------------------- | --------------------------------------- |
| `plugins:grafana-oncall-app:maintenance-reader` | Read-only access to OnCall Maintenance  |
| `plugins:grafana-oncall-app:maintenance-editor` | Read/write access to OnCall Maintenance |

### API keys

| Plugin role                                  | Description                                                       |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `plugins:grafana-oncall-app:api-keys-reader` | Read-only access to OnCall API Keys                               |
| `plugins:grafana-oncall-app:api-keys-editor` | Read/write access to OnCall API Keys + ability to consume the API |

### User settings

| Plugin role                                       | Description                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `plugins:grafana-oncall-app:user-settings-reader` | Read-only access to own OnCall User Settings                                             |
| `plugins:grafana-oncall-app:user-settings-editor` | Read/write access to own OnCall User Settings + view basic info about other OnCall users |
| `plugins:grafana-oncall-app:user-settings-admin`  | Read/write access to your own + other's OnCall User Settings                             |

### Notification and general settings

| Plugin role                                               | Description                                       |
| --------------------------------------------------------- | ------------------------------------------------- |
| `plugins:grafana-oncall-app:notification-settings-reader` | Read-only access to OnCall Notification Settings  |
| `plugins:grafana-oncall-app:notification-settings-editor` | Read/write access to OnCall Notification Settings |
| `plugins:grafana-oncall-app:settings-reader`              | Read-only access to OnCall Settings               |
| `plugins:grafana-oncall-app:settings-editor`              | Read/write access to OnCall Settings              |

## Private Data Connect plugin

Plugin ID: `grafana-pdc-app`

| Plugin role                                      | Description           |
| ------------------------------------------------ | --------------------- |
| `plugins:grafana-pdc-app:private-networks-read`  | Read Private Networks |
| `plugins:grafana-pdc-app:private-networks-write` | Edit Private Networks |

## SLO plugin

Plugin ID: `grafana-slo-app`

| Plugin role                          | Description                                                  |
| ------------------------------------ | ------------------------------------------------------------ |
| `plugins:grafana-slo-app:slo-reader` | View SLOs in folders where you have folder read permission   |
| `plugins:grafana-slo-app:slo-writer` | Manage SLOs in folders where you have folder edit permission |
| `plugins:grafana-slo-app:slo-admin`  | SLO Writer, plus the ability to modify org preferences       |

## Synthetic Monitoring plugin

Plugin ID: `grafana-synthetic-monitoring-app`

### Core roles

| Plugin role                                       | Description                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `plugins:grafana-synthetic-monitoring-app:admin`  | Full access to write and manage checks, probes, alerts, thresholds, and access tokens as well as enabling/disabling the plugin |
| `plugins:grafana-synthetic-monitoring-app:editor` | Add, update and delete checks, probes, alerts, and thresholds                                                                  |
| `plugins:grafana-synthetic-monitoring-app:reader` | Read checks, probes, alerts, thresholds, and access tokens                                                                     |

### Granular roles

| Plugin role                                                     | Description                     |
| --------------------------------------------------------------- | ------------------------------- |
| `plugins:grafana-synthetic-monitoring-app:checks-reader`        | Read checks                     |
| `plugins:grafana-synthetic-monitoring-app:checks-writer`        | Create, edit and delete checks  |
| `plugins:grafana-synthetic-monitoring-app:probes-reader`        | Read probes                     |
| `plugins:grafana-synthetic-monitoring-app:probes-writer`        | Create, edit and delete probes  |
| `plugins:grafana-synthetic-monitoring-app:alerts-reader`        | Read alerts                     |
| `plugins:grafana-synthetic-monitoring-app:alerts-writer`        | Create, edit and delete alerts  |
| `plugins:grafana-synthetic-monitoring-app:thresholds-reader`    | Read thresholds                 |
| `plugins:grafana-synthetic-monitoring-app:thresholds-writer`    | Read and edit thresholds        |
| `plugins:grafana-synthetic-monitoring-app:access-tokens-writer` | Create and delete access tokens |

## Role assignment

Plugin roles can be assigned to:

- **Users**: Individual user accounts
- **Teams**: All members of a team inherit the role
- **Basic Roles**: Can be added to Viewer, Editor, or Admin base roles

To assign roles, use:

- **UI**: Administration > Users/Teams > Select user/team > Roles tab
- **API**: `PUT /api/access-control/users/{userId}/roles` or `PUT /api/access-control/teams/{teamId}/roles`

For more information about managing RBAC roles, refer to [Manage RBAC roles](ref:manage-rbac-roles).

## Query plugin roles

You can query your Grafana Cloud stack's available plugin roles using the API:

```bash
curl -s -H "Authorization: Bearer YOUR_SERVICE_ACCOUNT_TOKEN" \
  "https://YOUR_STACK.grafana.net/api/access-control/roles?includeHidden=true" | \
  jq '[.[] | select(.name | startswith("plugins:"))]'
```

## Related documentation

- [RBAC for app plugins](ref:rbac-for-app-plugins): Overview of how RBAC works with app plugins
- [Folder access control](ref:folder-access-control): How folders interact with plugin roles
- [RBAC fixed role definitions](ref:rbac-fixed-basic-role-definitions): Fixed roles for Grafana features
- [Manage RBAC roles](ref:manage-rbac-roles): How to manage role assignments
