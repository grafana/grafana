---
aliases:
  - ../../enterprise/manage-single-access/
description: Manage multi-team access in a single Grafana instance
keywords:
  - grafana
  - rbac
  - lbac
  - auth
  - access
  - teams
labels:
  products:
    - cloud
    - enterprise
title: Manage multi-team access in a single Grafana instance
weight: 1200
refs:
  create-folder:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards/#create-a-dashboard-folder
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/manage-dashboards/#create-a-dashboard-folder
  rbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-control
  rbac-assign:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/assign-rbac-roles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-control/assign-rbac-roles
  rbac-fixed:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/#fixed-role-definitions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/#fixed-role-definitions
  drilldown:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION/explore/simplified-exploration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/simplified-exploration/
  add-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION/datasources/#add-a-data-source
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/#add-a-data-source
  lbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION/administration/data-source-management/teamlbac
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/label-access-policies
---

# Manage multi-team access in a single Grafana instance

If your organization has multiple teams using Grafana, you can use a single Grafana Enterprise deployment or a single Grafana Cloud stack to manage access across teams using roles and folders. This approach reduces complexity, simplifies identity and access management, and facilitates cross-team collaboration.

## Benefits

By using a single Grafana instance to manage access, you can:

- Implement a unified SSO, establishing clear permissions.
- Reduce setup and maintenance work, avoiding multi-stack complexity.
- Centralize plugin configuration and management.
- Ensure teams can access the right dashboards and data, avoiding stepping on or overwriting each other’s work.
- Enable collaboration across teams. Teams are not isolated in silos and can discover and collaborate with each other’s work.
- Optimize resource management. With shared spaces, like an “Everyone” folder, you can publish executive dashboards or cross-team metrics that all groups can benefit from, without duplicating it across stacks.

## Example: Three teams, one stack

Consider the following setup of three teams:

- Team A builds product features and needs autonomy with their own dashboards and data sources.
- Team B handles data engineering and needs autonomy with their own dashboards.
- Team C is the observability team and the admins of the Grafana stack.

Follow these suggested steps to structure, configure, and set permissions to access data in your Grafana instance:

1. [Before you begin](#before-you-begin)
1. [Create teams and configure user access](#create-teams-and-configure-user-access)
1. [Design a folder structure to match your access needs](#design-a-folder-structure-to-match-your-access-needs)
1. [Configure data access based on each team’s requirements](#configure-data-access-based-on-team-requirements)
1. [Scale access management with Terraform and SSO](#scale-access-management-with-terraform-and-sso)

### Before you begin

For more information on how to install a Grafana instance:

- If you’re using self-managed Grafana Enterprise, refer to [Configure Grafana](../../configure-grafana/).
- If you’re using Grafana Cloud, refer to [Your Grafana Cloud stack](https://grafana.com/docs/grafana-cloud/security-and-account-management/cloud-stacks).

{{< admonition type="note" >}}
For guidance on when to use one stack versus multiple, refer to [Stack architecture guidance](https://grafana.com/docs/grafana-cloud/security-and-account-management/cloud-stacks/stack-architecture-guidance/).
{{< /admonition >}}

### Create teams and configure user access

After you’ve deployed your Grafana instance:

- To follow the example in this doc, create three [Grafana Teams](../../../administration/team-management/configure-grafana-teams/#create-a-grafana-team) and add them to the Grafana instance.
- Determine the [RBAC](ref:rbac) strategy for your organization. RBAC extends default Grafana roles, provides more granular access rights, and simplifies how to grant, modify, or revoke user access to Grafana resources, such as users and reports.
- Assign each user to the [relevant team](../../../administration/user-management/manage-org-users/). By default [new users](../../configure-grafana/#auto_assign_org) are granted the **Viewer** role.
- Assign the [**Admin** role](ref:rbac-assign) to Team C so that they can manage all resources in the instance.

### Design a folder structure to match your access needs

To design a [folder](ref:create-folder) setup that helps users quickly understand where to go, what they can access, and what they can manage:

- Create an “Everyone” folder for shared items that all teams can manage (ie. grant them admin access to that folder).
- For each team, create a folder that they can manage and grant them the `fixed:teams:read` [fixed role](ref:rbac-assign). This means they can share items in their team folder with other teams, to encourage collaboration and learning from each other.
- For Team C, create an “Admins” folder for sensitive content only Admins can access.
- Optionally, create a personal folder for each team member so that they can work on draft content before moving it into their team folder when ready.

{{< figure src="/media/docs/grafana/oac/AccessTeams01.png" max-width="750px" alt="Teams and folders in the stack, and the related admin permissions Team A and Team B have been granted" >}}

### Configure data access based on team requirements

Next, focus on how teams interact with data to decide further access needs.

#### General resources

For resources accessible by all teams, grant the `datasources:explorer` fixed role to all teams so they can use the [Drilldown apps](ref:drilldown) for easily exploring data sources.

However, you may need to protect data in shared resources. For example, all teams can be forwarding metrics to a shared [data source](ref:add-data-source), but not everyone needs to see all of the data. In this case, grant each team query access to the data relevant for them, based on [label based access controls (LBAC) per team](ref:lbac). This way, you’ll maintain a central observability pipeline but still preserve data separation.

#### Team-specific resources

If any of your teams, Team A for example, need to build and manage their own data sources for product-specific use cases, grant the `datasources:creator` fixed role so they can create and manage their own data sources independently.

{{< figure src="/media/docs/grafana/oac/AccessTeams02.png" max-width="750px" alt="Teams and data sources in the stack, and the related permissions Team A and Team B have been granted" >}}

#### Resources at an instance level

Some Grafana resources, such as service accounts, alert contact points, [Fleet Management collectors](https://grafana.com/docs/grafana-cloud/send-data/fleet-management/), and other feature resources, are not linked to teams but are managed at the stack level. For these type of resources, assign fixed roles to teams carefully.

For example, users working in [Frontend Observability](https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/) need a writer fixed role so that they can create and manage services.

{{< figure src="/media/docs/grafana/oac/AccessTeams03.png" max-width="750px" alt="Grafana Cloud Frontend Observability resources in the stack, and the related permissions Team A have been granted" >}}

### Scale access management with Terraform and SSO

After you've made sure the model is working, you can codify it.

You can add any new users to your Grafana instance with an Identity Provider through [SCIM](../../configure-security/configure-scim-provisioning/). Use [role sync](../../configure-security/configure-authentication/saml/configure-saml-team-role-mapping/#configure-role-sync-for-saml) to ensure everyone is automatically assigned to the right team based on their membership, including those with the Admin role.

You can also use Terraform to provision teams their folders, fixed roles, and shared data source LBAC rules. For example, if you need to add a new team (Team D), you only need to add the new team to Grafana and run the Terraform script, which will automatically set them up to start using Grafana.

{{< figure src="/media/docs/grafana/oac/AccessTeams04.png" max-width="750px" alt="Add new Team D from Okta and automate the rest of their IAM setup using Terraform" >}}

## Other resources

Read on to learn more about access management:

- The [Least privilege custom role explainer](https://grafana.com/blog/2024/09/10/grafana-access-management-how-to-use-teams-for-seamless-user-and-permission-management/) blog walks through how to design roles that keep things simple and safe, so your users have just the access they need.
- See the [LBAC for metrics data sources](https://www.youtube.com/watch?v=gj27qKPSVsM) demo to learn how you can give every team a clear view of their own data while still benefiting from a shared pipeline.
- The [Introducing SCIM](https://grafana.com/blog/2025/05/14/introducing-scim-provisioning-in-grafana-enterprise-grade-user-management-made-simple/) post covers how to connect Grafana to your identity provider, making it easy to bring new users on board and keep permissions in sync as your organization grows.
