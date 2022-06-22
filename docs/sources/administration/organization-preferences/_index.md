---
aliases:
  - /docs/grafana/latest/administration/preferences/
  - /docs/grafana/latest/administration/preferences/change-grafana-name/
  - /docs/grafana/latest/administration/preferences/change-grafana-theme/
  - /docs/grafana/latest/administration/preferences/change-grafana-timezone/
  - /docs/grafana/latest/administration/change-home-dashboard/
  - /docs/grafana/latest/administration/preferences/change-home-dashboard/
title: Organization preferences
weight: 500
---

# Organization preferences

Grafana preferences are basic settings. They control the Grafana UI theme, home dashboard, time zone, and so on.

Preferences are sometimes confusing because they can be set at four different levels, listed from highest level to lowest:

- **Server -** Affects all users on the Grafana server. Set by a [Grafana server admin]({{< relref "../roles-and-permissions/#grafana-server-administrators" >}}).
- **Organization -** Affects all users in an organization. Set by an [Organization admin]({{< relref "../roles-and-permissions/#organization-roles" >}}).
- **Team -** Affects all users assigned to a team. Set by an Organization Admin or Team Admin. To learn more about these roles, refer to [Teams and permissions]({{< relref "../roles-and-permissions/#teams-and-permissions" >}}).
- **User account -** Affects the individual user. Set by the user on their own account.

The lowest level always takes precedence. For example, if a user sets their theme to **Light**, then their visualization of Grafana displays the light theme. Nothing at any higher level can override that.

If the user is aware of the change and intended it, then that's great! But if the user is a Server Admin who made the change to their user preferences a long time ago, they might have forgotten they did that. Then, if that Server Admin is trying to change the theme at the server level, they'll get frustrated as none of their changes have any effect that they can see. (Also, the users on the server might be confused, because _they_ can see the server-level changes!)

## Change Grafana name and email

In Grafana, you can change your names and emails associated with groups or accounts in the Settings or Preferences. This topic provides instructions for each task.

{{< docs/shared "preferences/some-tasks-require-permissions.md" >}}

### Change organization name

Grafana server administrators and organization administrators can change organization names.

#### Grafana Server Admin change organization name

Follow these instructions if you are a Grafana Server Admin.

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-org-list.md" >}}

1. In the organization list, click the name of the organization that you want to change.
1. In **Name**, enter the new organization name.
1. Click **Update**.
   {{< /docs/list >}}

#### Organization Admin change organization name

If you are an Organization Admin, follow these steps:

{{< docs/list >}}
{{< docs/shared "preferences/org-preferences-list.md" >}}

1. In **Organization name**, enter the new name.
1. Click **Update organization name**.
   {{< /docs/list >}}

### Change team name or email

Organization administrators and team administrators can change team names and email addresses.
To change the team name or email, follow these steps:

1. Hover your cursor over the **Configuration** (gear) icon in the side menu.
1. Click **Teams**. Grafana displays the team list.
1. In the team list, click the name of the team that you want to change.
1. Click the **Settings** tab.
1. In the Team Settings section, you can edit the following:
   - **Name -** Edit this field to change the display name associated with the team.
   - **Email -** Edit this field to change the email address associated with the team.
1. Click **Update**.

### Change user name or email

To learn how to edit your user information, refer to [Edit your profile]({{< relref "../user-management/user-preferences/#edit-your-profile" >}}).

## Change Grafana UI theme

In Grafana, you can modify the UI theme configured in the Settings or Preferences. Set the UI theme for the server, an organization, a team, or your personal user account using the instructions in this topic.

{{< docs/shared "preferences/some-tasks-require-permissions.md" >}}

### Theme options

The theme affects how Grafana displays graphs, menus, other UI elements.

#### Default

**Default** is either the dark theme or the theme selected in a higher level. For example, if an Organization administrator set the **Light** theme, then that is the default for all the teams in that organization.

#### Dark

Here is an example of the dark theme.

![Dark theme example](/static/img/docs/preferences/dark-theme-7-4.png)

#### Light

Here is an example of the light theme.

![Light theme example](/static/img/docs/preferences/light-theme-7-4.png)

### Change server UI theme

Grafana server administrators can change the Grafana UI theme for all users on the server by setting the [default_theme]({{< relref "../../setup-grafana/configure-grafana/#default-theme" >}}) option in the Grafana configuration file.

To see what the current settings are, refer to [View server settings]({{< relref "../stats-and-license#view-server-settings" >}}).

### Change organization UI theme

Organization administrators can change the UI theme for all users in an organization.

{{< docs/list >}}
{{< docs/shared "preferences/org-preferences-list.md" >}}
{{< docs/shared "preferences/select-ui-theme-list.md" >}}
{{< /docs/list >}}

### Change team UI theme

Organization and team administrators can change the UI theme for all users in a team.

{{< docs/list >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click on the team that you want to change the UI theme for and then navigate to the **Settings** tab.
   {{< docs/shared "preferences/select-ui-theme-list.md" >}}
   {{< /docs/list >}}

### Change your personal UI theme

You can change the UI theme for your user account. This setting overrides UI theme settings at higher levels.

{{< docs/list >}}
{{< docs/shared "preferences/navigate-user-preferences-list.md" >}}
{{< docs/shared "preferences/select-ui-theme-list.md" >}}
{{< /docs/list >}}

## Change the Grafana default timezone

By default, Grafana uses the timezone in your web browser. However, you can override this setting at the server, organization, team, or individual user level. This topic provides instructions for each task.

{{< docs/shared "preferences/some-tasks-require-permissions.md" >}}

### Set server timezone

Grafana server administrators can choose a default timezone for all users on the server by setting the [default_timezone]({{< relref "../../setup-grafana/configure-grafana/#default-timezone" >}}) option in the Grafana configuration file.

### Set organization timezone

Organization administrators can choose a default timezone for their organization.

{{< docs/list >}}
{{< docs/shared "preferences/org-preferences-list.md" >}}
{{< docs/shared "preferences/select-timezone-list.md" >}}
{{< /docs/list >}}

### Set team timezone

Organization administrators and team administrators can choose a default timezone for all users in a team.

{{< docs/list >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click on the team you that you want to change the timezone for and then navigate to the **Settings** tab.
   {{< docs/shared "preferences/select-timezone-list.md" >}}
   {{< /docs/list >}}

### Set your personal timezone

You can change the timezone for your user account. This setting overrides timezone settings at higher levels.

{{< docs/list >}}
{{< docs/shared "preferences/navigate-user-preferences-list.md" >}}
{{< docs/shared "preferences/select-timezone-list.md" >}}
{{< /docs/list >}}

## Change the default home dashboard

The home dashboard you set is the one all users will see by default when they log in. You can set the home dashboard for the server, an organization, a team, or your personal user account. This topic provides instructions for each task.

{{< docs/shared "preferences/some-tasks-require-permissions.md" >}}

### Navigate to the home dashboard

The home dashboard is the first dashboard a user sees when they sign in to Grafana. You can also navigate to the home dashboard manually.

1. Hover your cursor over the **Dashboards** (four squares) icon.
1. Click **Home**.

### Set the home dashboard for the server

Users with the Grafana Server Admin flag on their account or access to the configuration file can define a JSON file to use as the home dashboard for all users on the server.

#### [Optional] Convert an existing dashboard into a JSON file

1. Navigate to the page of the dashboard you want to use as the home dashboard.
1. Click the **Share dashboard** icon next to the dashboard title.
1. In the Export tab, click **Save to file**. Grafana converts the dashboard to a JSON file and saves it locally.

#### Use a JSON file as the home dashboard

1. Save your JSON file somewhere that Grafana can access it. For example, in the Grafana `data` folder of Grafana.
1. Update your configuration file to set the path to the JSON file. Refer to [default_home_dashboard_path]({{< relref "../../setup-grafana/configure-grafana/#default_home_dashboard_path" >}}) for more information about modifying the Grafana configuration files.

```ini
[dashboards]
# Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json"
default_home_dashboard_path = data/main-dashboard.json
```

> **Note:** On Linux, Grafana uses `/usr/share/grafana/public/dashboards/home.json` as the default home dashboard location.

### Set the home dashboard for your organization

Organization administrators can choose a home dashboard for their organization.

{{< docs/list >}}
{{< docs/shared "preferences/navigate-to-the-dashboard-list.md" >}}
{{< docs/shared "preferences/org-preferences-list.md" >}}
{{< docs/shared "preferences/select-home-dashboard-list.md" >}}
{{< /docs/list >}}

### Set home dashboard for your team

Organization administrators and Team Admins can choose a home dashboard for a team.

{{< docs/list >}}
{{< docs/shared "preferences/navigate-to-the-dashboard-list.md" >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click on the team that you want to change the home dashboard for and then navigate to the **Settings** tab.
   {{< docs/shared "preferences/select-home-dashboard-list.md" >}}
   {{< /docs/list >}}

### Set your personal home dashboard

You can choose your own personal home dashboard. This setting overrides all home dashboards set at higher levels.

{{< docs/list >}}
{{< docs/shared "preferences/navigate-to-the-dashboard-list.md" >}}
{{< docs/shared "preferences/navigate-user-preferences-list.md" >}}
{{< docs/shared "preferences/select-home-dashboard-list.md" >}}
{{< /docs/list >}}
