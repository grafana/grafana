---
aliases:
  - ../../../enterprise/access-control/rbac-for-app-plugins/
description: Learn about how to configure access to app plugins using RBAC
labels:
  products:
    - cloud
    - enterprise
menuTitle: RBAC for app plugins
title: RBAC for app plugins
weight: 90
refs:
  manage-rbac-roles-update-basic-role-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/manage-rbac-roles/#update-basic-role-permissions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/manage-rbac-roles/#update-basic-role-permissions
  restrict-access-to-app-plugin-example:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/plan-rbac-rollout-strategy/#prevent-viewers-from-accessing-an-app-plugin
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/plan-rbac-rollout-strategy/#prevent-viewers-from-accessing-an-app-plugin
  rbac-role-definitions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/
  plugin-role-definitions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/plugin-role-definitions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/plugin-role-definitions/
---

# RBAC for app plugins

{{< admonition type="note" >}}
Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud).
{{< /admonition >}}

RBAC can be used to manage access to [app plugins](https://grafana.com/docs/grafana/latest/administration/plugin-management/#app-plugins).
Each app plugin grants the basic Viewer, Editor and Admin organization roles a default set of plugin permissions.
You can use RBAC to restrict which app plugins a basic organization role has access to.
Some app plugins have fine-grained RBAC support, which allows you to grant additional access to these app plugins to teams and users regardless of their basic organization roles.

## Restricting access to app plugins

By default, Viewers, Editors and Admins have access to all App Plugins that their organization role allows them to access.
To change this default behavior and prevent a basic organization role from accessing an App plugin, you must [update the basic role's permissions](ref:manage-rbac-roles-update-basic-role-permissions).
See an example of [preventing Viewers from accessing an app plugin](ref:restrict-access-to-app-plugin-example) to learn more.
To grant access to a limited set of app plugins, you will need plugin IDs. You can find them in `plugin.json` files or in the URL when you open the app plugin in the Grafana Cloud UI.

Note that unless an app plugin has fine-grained RBAC support, it is not possible to grant access to this app plugin for a user whose organization role does not have access to that app plugin.

## Fine-grained access to app plugins

Plugins with fine-grained RBAC support allow you to manage access to plugin features at a more granular level.
For instance, you can grant admin access to an app plugin to a user with Viewer organization role. Or restrict the Editor organization role from being able to edit plugin resources.

For a centralized reference of all Grafana Cloud app plugin roles, default permissions by basic role, and available plugin roles, refer to [Grafana Cloud app plugin role definitions](ref:plugin-role-definitions). Some plugins also have dedicated RBAC documentation with additional context and use cases, linked in the table below.

The following table lists app plugins that have fine-grained RBAC support:

| App plugin                                                                                                                                                                            | App plugin ID                      | App plugin permission documentation                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Access policies](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/)                                                          | `grafana-auth-app`                 | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Adaptive Logs](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/reduce-costs/logs-costs/adaptive-logs/)                                                            | `grafana-adaptivelogs-app`         | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Adaptive Metrics](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/reduce-costs/metrics-costs/control-metrics-usage-via-adaptive-metrics/adaptive-metrics-plugin/) | `grafana-adaptive-metrics-app`     | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Adaptive Traces](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/reduce-costs/traces-costs/)                                                                      | `grafana-adaptivetraces-app`       | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Application Observability](https://grafana.com/docs/grafana-cloud/monitor-applications/application-observability/)                                                                   | `grafana-app-observability-app`    | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Attributions](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/understand-costs/attribution/)                                                                      | `grafana-attributions-app`         | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Cloud Provider](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/)                                                                               | `grafana-csp-app`                  | [Cloud Provider Observability role-based access control](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/rbac/)                                             |
| [Collector](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/agent/collector/)                                                                              | `grafana-collector-app`            | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Cost Management and Billing](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/)                                                                                    | `grafana-cmab-app`                 | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Frontend Observability](https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/)                                                                         | `grafana-kowalski-app`             | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Grafana Assistant](https://grafana.com/docs/grafana-cloud/alerting-and-irm/machine-learning/llm-plugin/)                                                                             | `grafana-assistant-app`            | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Incident](https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/incident/)                                                                                                     | `grafana-incident-app`             | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Integrations and Connections](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/)                                                                                     | `grafana-easystart-app`            | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [IRM](https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/)                                                                                                                   | `grafana-irm-app`                  | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [IRM Labels](https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/)                                                                                                            | `grafana-labels-app`               | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Knowledge Graph](https://grafana.com/docs/grafana-cloud/monitor-applications/asserts/)                                                                                               | `grafana-asserts-app`              | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Kubernetes Monitoring](/docs/grafana-cloud/monitor-infrastructure/kubernetes-monitoring/)                                                                                            | `grafana-k8s-app`                  | [Kubernetes Monitoring role-based access control](/docs/grafana-cloud/monitor-infrastructure/kubernetes-monitoring/configuration/control-access/#precision-access-with-rbac-custom-plugin-roles) |
| [Machine Learning](https://grafana.com/docs/grafana-cloud/alerting-and-irm/machine-learning/)                                                                                         | `grafana-ml-app`                   | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [OnCall](https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/oncall/)                                                                                                         | `grafana-oncall-app`               | [Configure RBAC for OnCall](https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/oncall/manage/user-and-team-management/#manage-users-and-teams-for-grafana-oncall)                       |
| [Performance Testing (k6)](https://grafana.com/docs/grafana-cloud/testing/k6/)                                                                                                        | `k6-app`                           | [Configure RBAC for k6](https://grafana.com/docs/grafana-cloud/testing/k6/projects-and-users/configure-rbac/)                                                                                    |
| [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/)                                                    | `grafana-pdc-app`                  | [Plugin role definitions](ref:plugin-role-definitions)                                                                                                                                           |
| [Service Level Objective (SLO)](https://grafana.com/docs/grafana-cloud/alerting-and-irm/slo/)                                                                                         | `grafana-slo-app`                  | [Configure RBAC for SLO](https://grafana.com/docs/grafana-cloud/alerting-and-irm/slo/set-up/rbac/)                                                                                               |
| [Synthetic Monitoring](https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/)                                                                                          | `grafana-synthetic-monitoring-app` | [Configure RBAC for Synthetic Monitoring](https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/user-and-team-management/)                                                         |

### Revoke fine-grained access from app plugins

To list all the permissions granted to a basic role, use the [HTTP API endpoint to query for the role](https://grafana.com/docs/grafana/latest/developers/http_api/access_control/#get-a-role).
Basic role UIDs are listed in [RBAC role definitions list](ref:rbac-role-definitions).
To remove the undesired plugin permissions from a basic role, you must [update the basic role's permissions](ref:manage-rbac-roles-update-basic-role-permissions).

### Grant additional access to app plugins

To grant access to app plugins, you can use the predefined [fixed plugin roles](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/#fixed-roles) or create [custom roles](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/#custom-roles) with specific plugin permissions.
To learn about how to assign an RBAC role, refer to [the documentation on assigning RBAC roles](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/assign-rbac-roles/#assign-rbac-roles).
