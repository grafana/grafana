---
description: Learn how to use group attribute sync to synchronize between groups in your authentication provider and Grafana RBAC roles.
labels:
  products:
    - cloud
    - enterprise
title: Configure group attribute sync
weight: 1000
---

# Configure group attribute sync

Group attribute sync allows you to manage user permissions in Grafana based on group membership sourced from the user's identity provider (IdP).
Groups are mapped to [fixed](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control#fixed-roles) and [custom](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control#custom-roles) role-based access control roles in Grafana.

> **Note:** Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise) and [Grafana Cloud](/docs/grafana-cloud/).

{{% admonition type="note" %}}
This feature is behind the `groupAttributeSync` feature toggle.
You can enable feature toggles through configuration file or environment variables. See configuration [docs](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles) for details.
{{% /admonition %}}

When a user logs in, Grafana checks the user's external group memberships and the configured group to role mappings to assign the corresponding roles to the user.
If the user's group memberships change or a new mapping is created, the user's role assignments are updated the next time the user logs in.
If a group mapping is removed, the role assignment to users for the group mapping is revoked immediately.

Role mappings are tied to organizations, so you can have different mappings for different organizations.

## Supported providers

- [Azure AD](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread#group-sync-enterprise-only)
- [Generic OAuth integration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/generic-oauth#configure-group-synchronization)
- [GitHub OAuth](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/github#configure-group-synchronization)
- [GitLab OAuth](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/gitlab#configure-group-synchronization)
- [Google OAuth](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/google#configure-group-synchronization)
- [LDAP](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/enhanced-ldap#ldap-group-synchronization)
- [Okta](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/okta#configure-group-synchronization-enterprise-only)
- [SAML](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/saml#configure-group-synchronization)

## Create role mappings for a new group

For information about creating group mappings via the API, refer to [create group mappings reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/group_attribute_sync#create-group-mappings).

### Before you begin

Ensure you have permission to create and update group mappings. By default, the organization administrator role is required to create and edit group mappings. For more information about user permissions, refer to [roles and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions).

### To create mappings between an external group and RBAC roles

1. Sign in to Grafana and click **Administration** in the left-side menu.
1. Click **Users and access**.
1. Click **External group sync**.
1. Click **New**.
1. Insert the group identifier for the group that you want to map.
1. Use the role picker to select the roles that you want to map to the group and click **Update**.
1. Click **Save**.

## Update role mappings for a group

For information about updating group mappings via the API, refer to [update group mappings reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/group_attribute_sync#update-group-mappings).

### Before you begin

Ensure you have permission to update group mappings. By default, the organization administrator role is required to edit group mappings. For more information about user permissions, refer to [roles and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions).

### To update role mappings for an external group

1. Sign in to Grafana and click **Administration** in the left-side menu.
1. Click **Users and access**.
1. Click **External group sync**.
1. Find the group whose mappings you want to update.
1. Click on the role picker corresponding to the group and select the roles that you want to map.
1. Click **Apply**.

## Remove role mappings for a group

For information about deleting group mappings via the API, refer to [delete group mappings reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/group_attribute_sync#delete-group-mappings).

### Before you begin

Ensure you have permission to update group mappings. By default, the organization administrator role is required to edit group mappings. For more information about user permissions, refer to [roles and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions).

### To remove role mappings for an external group

1. Sign in to Grafana and click **Administration** in the left-side menu.
1. Click **Users and access**.
1. Click **External group sync**.
1. Find the group whose mappings you want to remove.
1. Click on the trash bin icon corresponding to the group mappings you want to remove.
