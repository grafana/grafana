+++
title = "Add a user to an organization"
aliases = ["path here"]
weight = 70
+++

# Add a user to an organization

Add a user account to an existing organization. User accounts can belong to multiple organizations, but each user account must belong to at least one organization.

You are required to specify an Admin role for each organization. The first user you add to an organization becomes the Admin by default. After you assign the Admin role to a user, you can add other users to an organization as either Admins, Editors, or Viewers.

## Before you begin

- [Add an organization](NEED LINK)
- [Add a user]({{< relref "./add-user.md">}})
- Ensure you have Grafana server administrator privileges

**To add a user to an organization**:

1. Sign in to Grafana as a server administrator.

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-user-list-search.md" >}}

1. Click a user.
1. In the **Organizations** section, click **Add user to organization**.
1. Select an organization and a role.

   For more information about user permissions, refer to [Organization roles]({{< relref "../about-users-and-permissions/#organization-roles">}}).

1. Click **Add to organization**.
   {{< /docs/list >}}

   <!--- Is the user made aware of this change, through email maybe? -->
