+++
aliases = ["/docs/grafana/latest/administration/manage-users-and-permissions/manage-server-users/add-user/"]
title = "Add a user"
weight = 10
+++

# Add a user

Add users when you want to manually provide individuals with access to Grafana.

When you create a user using this method, you must create their password. The user does not receive a notification by email. To invite a user to Grafana and allow them to create their own password, [invite a user to join an organization]({{< relref "../manage-org-users/invite-user-join-org.md" >}}).

When you configure advanced authentication using Oauth, SAML, LDAP, or the Auth proxy, users are created automatically.

## Before you begin

- Ensure that you have Grafana server administrator privileges

**To add a user**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click **New user**.
1. Complete the fields and click **Create user**.

When you create a user, the system assigns the user viewer permissions in a default organization, which you can change. You can now [add a user to a second organization]({{< relref "./add-remove-user-to-org.md" >}}).

> **Note:** If you have [organization administrator]({{< relref "../about-users-and-permissions.md#organization-roles" >}}) permissions and _not_ [server administrator]({{< relref "../about-users-and-permissions.md#grafana-server-administrators" >}}) permissions, you can still add users by [inviting a user to join an organization]({{< relref "../../manage-users-and-permissions/manage-org-users/invite-user-join-org.md" >}}).
