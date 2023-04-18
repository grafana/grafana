---
aliases:
  - preferences.md/
title: Preferences
weight: 50
---

# Grafana preferences

Grafana preferences are basic settings. They control the Grafana UI theme, home dashboard, time zone, and so on.

Preferences are sometimes confusing because they can be set at four different levels, listed from highest level to lowest:

- **Server -** Affects all users on the Grafana server. Set by a [Grafana Server Admin]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}}).
- **Organization -** Affects all users in an organization. Set by an [Organization Admin]({{< relref "../../permissions/organization_roles.md#organization-admin-role" >}}).
- **Team -** Affects all users assigned to a team. Set by an Organization Admin or Team Admin. To learn more about these roles, refer to [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}).
- **User account -** Affects the individual user. Set by the user on their own account.

The lowest level always takes precedence. For example, if a user sets their theme to **Light**, then their visualization of Grafana displays the light theme. Nothing at any higher level can override that.

If the user is aware of the change and intended it, then that's great! But if the user is a Server Admin who made the change to their user preferences a long time ago, they might have forgotten they did that. Then, if that Server Admin is trying to change the theme at the server level, they'll get frustrated as none of their changes have any effect that they can see. (Also, the users on the server might be confused, because _they_ can see the server-level changes!)
