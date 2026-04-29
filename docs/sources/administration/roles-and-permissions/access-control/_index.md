---
aliases:
  - ../../enterprise/access-control/
  - ../../enterprise/access-control/about-rbac/
  - ../../enterprise/access-control/roles/
description: Role-based access control (RBAC) provides a standardized way of granting,
  changing, and revoking access so that users can view and modify Grafana resources,
  such as users and reports.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Role-based access control (RBAC)
title: Grafana Role-based access control (RBAC)
weight: 120
refs:
  api-rbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/
  rbac-role-definitions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/
  rbac-role-definitions-basic-role-assignments:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/#basic-role-assignments
    - pattern: /docs/grafana-cloud/
  rbac-manage-rbac-roles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/manage-rbac-roles/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/manage-rbac-roles/
  rbac-assign-rbac-roles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/assign-rbac-roles/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/assign-rbac-roles/
  rbac-basic-role-uid-mapping:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/manage-rbac-roles/#list-permissions-associated-with-roles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/manage-rbac-roles/#list-permissions-associated-with-roles
  service-accounts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/
  roles-and-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/cloud-roles/
  dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/
  dashboards-annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  dashboards-create-reports:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/create-reports/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/create-reports/
  dashboards-manage-library-panels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-library-panels/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/manage-library-panels/
  dashboards-create-a-dashboard-folder:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards/#create-a-dashboard-folder
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/manage-dashboards/#create-a-dashboard-folder
  folder-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards/#folder-permissions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/manage-dashboards/#folder-permissions
  migrate-api-keys:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/migrate-api-keys/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/migrate-api-keys/
---

# Role-based access control (RBAC) overview

{{< admonition type="note" >}}
Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](https://grafana.com/docs/grafana-cloud).
{{< /admonition >}}

Role-based access control (RBAC) provides a standardized way of granting, changing, and revoking access so that users can view and modify Grafana resources such as dashboards, reports, and administrative settings. RBAC extends the permissions of basic roles included in Grafana OSS, and enables more granular control of users’ actions.

You can use RBAC to:

- Modify existing basic roles: for example, enable an editor to create reports.
- Assign fixed roles to users and teams: for example, grant an engineering team the ability to create data sources.
- Create custom roles: for example, a role that allows users to create and edit dashboards, but not delete them.

## RBAC roles and permissions

RBAC roles are associated to multiple permissions, each of which has an action and a scope:

- **Action:** An action describes what tasks a user can perform on a resource.
- **Scope:** A scope describes where an action can be performed, such as reading a specific user profile. In this example, a permission is associated with the scope `users:<userId>` to the relevant role.

For more information refer to [RBAC permission's actions and scopes](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/).

## Available RBAC roles

You can assign the following RBAC roles in Grafana:

- **Basic role**: [Basic roles](#basic-roles) are the standard roles available in Grafana OSS.
- **Fixed role**: If you're using Grafana Enterprise or Grafana Cloud, you can assign discrete [fixed roles](#fixed-roles) to users, teams, and service accounts for improved control over user permissions than you cannot have with basic roles alone.
- **Custom role**: If you're using Grafana Enterprise or Grafana Cloud, use [custom roles](#custom-roles) to create unique combinations of permission _actions_ and _scopes_.

Additionally, if you're using Grafana Cloud app plugins, there's roles to control access to specific plugin features and can be assigned to users, teams, or basic roles. For more information refer to [RBAC for app plugins](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-for-app-plugins).

### Basic roles

Basic roles are the standard roles that are available in Grafana OSS. If you're using Grafana Enterprise or Cloud you can still use basic roles.

Grafana includes the following basic roles:

- Grafana administrator
- Organization administrator
- Editor
- Viewer
- None

{{< admonition type="caution" >}}
All Grafana users must have a basic role assigned. Use the `None` role for users with no permissions.
{{< /admonition >}}

Each basic role is comprised of a number of _permissions_. For example, the viewer basic role contains the following permissions, among others:

- `Action: datasources.id:read, Scope: datasources:*`: Enables the viewer to see the ID of a data source.
- `Action: orgs:read`: Enables the viewer to see their organization details
- `Action: annotations:read, Scope: annotations:*`: Enables the viewer to see annotations that other users have added to a dashboard.

For a comprehensive list of the basic role permissions refer to [Permissions associated to basic roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definition#permissions-associated-to-basic-roles).

#### Modify basic roles

You can use RBAC to modify the permissions associated with any basic role, which changes what viewers, editors, or admins can do. If you modify a basic role, [the change is not propagated to the other basic roles](#permission-propagation). You can't delete basic roles.

You can modify basic roles using the configuration file or with the RBAC API. Refer to [Manage RBAC roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/manage-rbac-roles) to learn how.

Note that:

- You cannot use a service account to modify basic roles via the RBAC API. To update basic roles, you must be a Grafana administrator and use basic authentication with the request.
- If you're a Cloud customer, contact Support to reset roles.

### Fixed roles

If you're using Grafana Enterprise or Grafana Cloud, you can assign discrete fixed roles to users, teams, and service accounts. This gives you fine-grained control over user permissions than you would have with basic roles alone. These roles are called "fixed" because you cannot change or delete fixed roles. You can also create _custom_ roles of your own; see more information in the [custom roles section](#custom-roles) below.

Assign fixed roles when the basic roles do not meet your permission requirements. For example, you might want a user with the basic viewer role to also edit dashboards. Or, you might want anyone with the editor role to also add and manage users. Fixed roles provide users more granular access to create, view, and update the following Grafana resources:

- [Alerting](ref:alerting)
- [Annotations](ref:dashboards-annotate-visualizations)
- [API keys](ref:migrate-api-keys)
- [Dashboards and folders](ref:dashboards)
- [Data sources](ref:data-sources)
- [Explore](/docs/grafana/<GRAFANA_VERSION>/explore/)
- [Feature Toggles](/docs/grafana/<GRAFANA_VERSION>/administration/feature-toggles/)
- [Folders](ref:dashboards-create-a-dashboard-folder)
- [LDAP](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/ldap/)
- [Library panels](ref:dashboards-manage-library-panels)
- [Licenses](/docs/grafana/<GRAFANA_VERSION>/administration/stats-and-license/)
- [Organizations](/docs/grafana/<GRAFANA_VERSION>/administration/organization-management/)
- [Provisioning](/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/)
- [Reports](ref:dashboards-create-reports)
- [Roles](ref:roles-and-permissions)
- [Service accounts](ref:service-accounts)
- [Settings](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/settings-updates-at-runtime/)
- [Teams](/docs/grafana/<GRAFANA_VERSION>/administration/team-management/)
- [Users](/docs/grafana/<GRAFANA_VERSION>/administration/user-management/)

To learn more about the permissions you can grant for each resource, refer to [RBAC role definitions](ref:rbac-role-definitions).

### Custom roles

If you're using Grafana Enterprise or Grafana Cloud, you can create custom roles to manage user permissions in a way that meets your security requirements. Custom roles contain unique combinations of permissions _actions_ (the allowed task) and _scopes_ (where to perform the task).

For example:

- The `teams.roles:read` action allows a user to see a list of roles associated with each team.
- The `teams:id:1` scope restricts the user's action to the team with ID `1`. When paired with the `teams.roles:read` action, this permission prohibits the user from viewing the roles for teams other than team `1`.

Consider creating a custom role only when fixed roles do not meet your permissions requirements. To learn more, refer to [Create custom roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/create-custom-roles).

## Permission propagation

If you modify a specific basic role, the change is not propagated to the other basic roles. In other words, if you modify Viewer basic role and grant it additional permissions, Editors or Admins won't be updated with that additional grant.

## New permissions

When a new permission is created, it's added automatically to modified basic roles. This means that a feature you thought you removed can get new permissions added back.

If you're using custom roles, new permissions are not added automatically. If a new feature that requires additional permissions is released, you will have to add the permissions to custom roles manually. 

### Stop automatic access to new features

You can stop new plugins or apps from being automatically accessible to users with the default Editor or Viewer basic roles in Grafana Cloud. While this will not prevent new core Grafana features or new permissions inside existing apps from appearing, it will limit plugin access. For core RBAC changes, you will need to manage drift manually or set up automation.

The `basic_editor` and `basic_viewer` roles often include:

```json
{
  "action": "plugins.app:access",
  "scope": "plugins:\*"
}
```

This allows access to all current and future plugins, including ones your users may not need or have licensed, such as IRM, Machine Learning, or Synthetics.

To prevent this, you can:

- Remove the wildcard access.
- Add explicit plugin permissions for only the apps you want.

To do so, follow these steps:

1. Get the current definition of the role. Refer to [View role definitions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/manage-rbac-roles#view-basic-role-definitions) for more details.

1. Modify the role definition. Open the JSON file, remove this permission, and add only the plugin IDs you want to keep access to. Make sure to include cloud-home-app or the homepage will result in a 404 error. For example:

   ```
   {
   "action": "plugins.app:access",
   "scope": "plugins:id:grafana-kowalski-app"
   },
   {
   "action": "plugins.app:access",
   "scope": "plugins:id:cloud-home-app"
   }
   ```

1. Optionally, if apps include fixed roles or granular actions, specify the required role-based permissions.

1. Bump the role version. Find the version field in the JSON and increment it by 1.

1. Update the modified role via the API:

   ```
   curl -X PUT -H "Authorization: Bearer <admin SA token>" \
    -H "Content-Type: application/json" \
    https://<your-stack>.grafana.net/api/access-control/roles/basic_editor \
    -d @editor_custom_role.json
   ```

## RBAC limitations

If you have created a folder with the name `General` or `general`, you cannot manage its permissions with RBAC.

If you set [folder permissions](ref:folder-permissions) for a folder named `General` or `general`, the system disregards the folder when RBAC is enabled.

## The RBAC API

For information on the RBAC API refer to the [RBAC API documentation](ref:api-rbac).
