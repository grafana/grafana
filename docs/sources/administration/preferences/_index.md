+++
title = "Preferences"
weight = 50
+++

# Grafana preferences

Grafana preferences are basic settings. They control your Grafana theme, your home dashboard, your time zone, and so on.

Preferences are sometimes confusing, because they can be set at four different levels. Listed in order from highest to lowest, they are:

- **Server -** Affects all users on the Grafana server. Set by a Grafana server administrator.
- **Organization -** Affects all users in an organization. Set by an organization administrator.
- **Team -** Affects all users in assigned to a team. Set by an organization administrator or team administrator.
- **User account -** Affects only the individual user. Set by the user on their own account.

The lowest level always takes precedence. For example, if a user sets their theme to **Light**, then their Grafana will be displayed in the Light theme. Nothing at any higher level can override that.

Now, if the user is aware of the change and intended it, then that's great! But if the user is a Server Admin who made the change to their user preferences a long time ago, they might have forgotten they did that. Then, if that Server Admin is trying to change the theme at the server level, they will get quite frustrated as none of their changes have any effect that they can see. (Also, the users on the server might be confused, because _they_ can see the server-level changes!)