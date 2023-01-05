---
description: How to set the Grafana UI theme
keywords:
  - grafana
  - configuration
  - documentation
  - home
title: Change UI theme
weight: 200
---

# Change Grafana UI theme

In Grafana, you can modify the UI theme configured in the Settings or Preferences. Set the UI theme for the server, an organization, a team, or your personal user account using the instructions in this topic.

{{< docs/shared "preferences/some-tasks-require-permissions.md" >}}

## Theme options

The theme affects how Grafana displays graphs, menus, other UI elements.

### Default

**Default** is either the dark theme or the theme selected in a higher level. For example, if an Organization administrator set the **Light** theme, then that is the default for all the teams in that organization.

### Dark

Here is an example of the dark theme.

![Dark theme example](/static/img/docs/preferences/dark-theme-7-4.png)

### Light

Here is an example of the light theme.

![Light theme example](/static/img/docs/preferences/light-theme-7-4.png)

## Change server UI theme

Grafana server administrators can change the Grafana UI theme for all users on the server by setting the [default_theme]({{< relref "../configuration.md#default-theme" >}}) option in the Grafana configuration file.

To see what the current settings are, refer to [View server settings]({{< relref "../view-server/view-server-settings.md" >}}).

## Change organization UI theme

Organization administrators can change the UI theme for all users in an organization.

{{< docs/list >}}
{{< docs/shared "preferences/org-preferences-list.md" >}}
{{< docs/shared "preferences/select-ui-theme-list.md" >}}
{{< /docs/list >}}

## Change team UI theme

Organization and team administrators can change the UI theme for all users in a team.

{{< docs/list >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click on the team that you want to change the UI theme for and then navigate to the **Settings** tab.
   {{< docs/shared "preferences/select-ui-theme-list.md" >}}
   {{< /docs/list >}}

## Change your personal UI theme

You can change the UI theme for your user account. This setting overrides UI theme settings at higher levels.

{{< docs/list >}}
{{< docs/shared "preferences/navigate-user-preferences-list.md" >}}
{{< docs/shared "preferences/select-ui-theme-list.md" >}}
{{< /docs/list >}}
