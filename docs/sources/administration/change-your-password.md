+++
title = "Change your password"
description = "How to change your Grafana password"
keywords = ["grafana", "password", "change", "preferences"]
type = "docs"
[menu.docs]
identifier = "change-your-password"
parent = "administration"
weight = 100
+++

# Change your Grafana password

You can change your password in the Change Password tab.

> **Note:** If your Grafana instance uses an external authentication provider, then you might not be able to change your password. Contact your Grafana administrator for more information.

## Change your password

1. Hover your mouse over your user icon in the lower left corner of the screen.
1. Click **Change Password**. Grafana opens the Change Password tab.
1. Enter your **Old password** to authorize the change.
1. Enter your **New password** and then **Confirm password**.
1. Click **Change Password**.

## Admin user management resources

Grafana admins can use the following tools:

- Use the [User API]({{< relref "../http_api/user.md" >}}) to change your password programmatically or to manage users.
- The [Manage users]({{< relref "../manage-users/_index.md" >}}) section explains how to manage users and teams.
