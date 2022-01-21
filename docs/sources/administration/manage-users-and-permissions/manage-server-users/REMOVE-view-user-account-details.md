+++
title = "View user account details"
aliases = ["path here"]
weight = 70
+++

# View user account details

See all details associated with a specific user account.

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-user-list.md" >}}

1. Click the user account you wish to view. If necessary, use the search field at the top of the tab to search for the specific user account that you need.
   {{< /docs/list >}}

Each user account contains the following sections.

### User information

This section of the account contains basic user information. Users can change values in these fields on their own account.

- **Name**
- **Email**
- **Username**
- **Password**

![Server Admin user information section](/static/img/docs/manage-users/server-admin-user-information-7-3.png)

### Permissions

This indicates whether the user account has the Grafana Admin flag applied or not. If it is **Yes**, then the user is a Grafana Server Admin.

![Server Admin Permissions section](/static/img/docs/manage-users/server-admin-permissions-7-3.png)

### Organisations

This section lists the organizations the user account belongs to and the roles they hold within each organization.

![Server Admin Organizations section](/static/img/docs/manage-users/server-admin-organisations-7-3.png)

### Sessions

See recent sessions that the user was logged on, including when they logged on and information about the system the logged on with. You can force logouts if necessary.

![Server Admin Sessions section](/static/img/docs/manage-users/server-admin-sessions-7-3.png)
