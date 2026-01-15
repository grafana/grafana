---
description: Learn how to configure Grafana Teams
labels:
  products:
    - enterprise
    - oss
    - cloud
keywords:
  - authorization
  - microservices
  - architecture
menuTitle: Configure Grafana Teams
title: Configure Grafana Teams
weight: 200
---

# Configure Grafana Teams

This topic describes how to set up and configure Grafana Teams.

For a tutorial on working with Teams, refer to [Create users and teams](https://grafana.com/tutorials/create-users-and-teams/).

## Before you begin

Before you begin creating and working with Grafana Teams:

- Ensure that you have either the `Organization Administrator` role or team administrator permissions.
  Refer to [Organization roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/#organization-roles) and [RBAC permissions, actions, and scopes](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/#rbac-permissions-actions-and-scopes) for a list of Grafana roles and role-based access control actions.
- Decide which users belong to which teams and what permissions team members receive.
- Configure the default basic role for users to join Grafana. This role applies to users where no role is set by the identity provider (IDP).
  - No basic role - by default can't view any resources.
    Recommended for `isolated` teams.
  - Viewer role - by default can view all resources. Recommended for `collaborative` teams.
- Ensure team sync is turned on if you plan to manage team members through team sync.
Refer to [Configure Team Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-team-sync/) for a list of providers and instructions on how to turn on team sync for each provider.
<!-- - Turn on nested folders.  __This is a new feature, add when it goes live.__ -->

{{< admonition type="note" >}}
[Grafana Organizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/organization-management/) do not exist in Grafana Cloud.
Grafana Cloud uses the term _organization_ to refer to accounts in grafana.com, or GCOM.
In Grafana Enterprise and OSS, Teams belong to Grafana Organizations.
Refer to [About organizations](/docs/grafana/<GRAFANA_VERSION>/administration/organization-management/#about-organizations) for more information.
{{< /admonition >}}

## Create a Grafana Team

A team is a group of users within a Grafana instance that have common permissions needs. Teams to help make user-permission management more efficient. A user can belong to multiple Teams.
Grafana Teams includes common access to the following:

- dashboards
- data sources
- folders
- alerts
- reports
- cloud access policies
- annotations
- playlists

To create a Team, complete the following steps:

1. Sign in to Grafana as an `org administrator` or `team administrator`.
1. Click the arrow next to **Administration** in the left-side menu, click **Users and access**, and select **Teams**.
1. Click **New Team**.
1. Fill in each field and click **Create**.
1. Click **Save**. You can now add a Team member.

## Add a Team member

Add a member to a new Team or add a team member to an existing Team when you want to provide access to team dashboards and folders to another user. This task requires that you have `organization administrator` permissions.

To add a team member, complete the following steps:

1. Sign in to Grafana as an `org administrator` or `team administrator`.
1. Click the arrow next to **Administration** in the left-side menu, click **Users and access**, and select **Teams**.
1. Click the name of the Team to which you want to add members, and click **+ Add member**.
1. Search for and select a user.
1. Choose whether to add the user as a Team **Member** or **Admin**.
1. Click **Save**.

## Grant or change Team member permissions

Complete this task when you want to add or modify team member permissions.

To grant team member permissions:

1. Sign in to Grafana as an `org administrator` or `team administrator`.
1. Click the arrow next to **Administration** in the left-side menu, click **Users and access**, and select **Teams**.
1. Click the pencil next to the name of the Team for which you want to add or modify team member permissions.
1. In the team member list, locate the user that you want to change. You can use the search field to filter the list if necessary.
1. Under the **Permission** column, select the new permission level.

## Add roles to a Grafana Team

You can add or delete roles from a specified team.

To add a role, complete the following steps:

1. Sign in to Grafana as an `org administrator` or `team administrator`.
1. Click the arrow next to **Administration** in the left-side menu, click **Users and access**, and select **Teams**.
1. Select the Team and click under the **Role** column.
   Select from a list of current fixed or plugin roles or clear all roles and start over.
   As you hover over each role a list of permissions appears to the right.
   You can clear any permission for additional fine-grained control.
1. Click **Update** to add the new role or roles.

To delete a role, remove the check next to the role name and click **Update**.

## Delete a team

Delete a team when you no longer need it. This action permanently deletes the team and removes all team permissions from dashboards and folders. This task requires that you have `organization administrator` permissions.

1. Sign in to Grafana as an `org administrator` or `team administrator`.
1. Click the arrow next to **Administration** in the left-side menu, click **Users and access**, and select **Teams**.
1. Click the **red X** on the right side of the name of the team.
1. Click **Delete**.

<!-- ## Create isolated or collaborative teams

Grafana Teams can either be `isolated` or `collaborative`. Isolated teams can only see their own resources. They can't see other team’s dashboards, data, or alerts. Collaborative teams have access to other team’s resources. Grafana Cloud users must contact Support.

To create an isolated team add the following to the Grafana configuration file:

```ini
auto_assign_org_role = None
role_attribute_path = contains(groups[*], 'admin') && 'Admin' || 'None'
```

To create a collaborative team add the following to the Grafana configuration file:

```ini
auto_assign_org_role = Viewer
role_attribute_path = contains(groups[*], 'admin') && 'Admin' || 'None'
```
You can also use a terraform script as shown in the following example:

```hcl
terraform {
  required_providers {
    grafana = {
      source = "grafana/grafana"
    }
  }
}

provider "grafana" {
  url  = "http://localhost:3000/"
  auth = "admin:admin"
}

resource "grafana_folder" "awesome_folder" {
  title = "Awesome Team Folder"
}


resource "grafana_team" "awesome-team" {
  name  = "Awesome Team"
}

resource "grafana_team_external_group" "awesome-team-group" {
  team_id = grafana_team.awesome-team.id
  groups = [
    "Awesome_group"
  ]
}

resource "grafana_role" "team_role" {
  name  = "team_role"
  uid = "team_role"
  version = 4
  global = true

  permissions {
    action = "datasources:create"
  }

  permissions {
    action = "serviceaccounts:create"
  }

  # below should be deleted after bug fix to view service accounts
  permissions {
    action = "users.roles:read"
    scope = "users:id:*"
  }

}

resource "grafana_role_assignment" "assign_role" {
  role_uid         = grafana_role.team_role.uid
  teams            = [grafana_team.awesome-team.id]
}

resource "grafana_service_account" "awesome_service_account" {
  name        = "awesome_service_account"
  role        = "None"
  is_disabled = false
}

resource "grafana_service_account_permission" "awesome_service_account_permissions" {
  service_account_id = grafana_service_account.awesome_service_account.id

  permissions {
    team_id    = grafana_team.awesome-team.id
    permission = "Admin"
  }
}

resource "grafana_folder_permission" "awesome_folder_permission" {
  folder_uid = grafana_folder.awesome_folder.uid
  permissions {
    team_id    = grafana_team.awesome-team.id
    permission = "Admin"
  }

  permissions {
    user_id = grafana_service_account.awesome_service_account.id
    permission = "Admin"
  }
}
``` -->
