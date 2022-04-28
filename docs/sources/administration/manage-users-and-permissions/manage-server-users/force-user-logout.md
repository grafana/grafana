+++
title = "Force a user to logout from Grafana"
aliases = ["/docs/grafana/latest/administration/manage-users-and-permissions/manage-server-users/force-user-logout/"]
weight = 90
+++

# Force a user to log out of Grafana

If you suspect a user account is compromised or is no longer authorized to access the Grafana server, then you can force the user to log out of Grafana.

The force logout action can apply to one device that is logged in to Grafana, or all devices logged in to Grafana.

## Before you begin

- Ensure you have Grafana server administrator privileges

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click a user.
1. Scroll down to the **Sessions** section.
1. Perform one of the following actions:
   - Click **Force logout** next to the session entry that you want logged out of Grafana.
   - Click **Force logout from all devices**.
1. Confirm the logout.
