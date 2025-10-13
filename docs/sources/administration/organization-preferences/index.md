---
aliases:
  - change-home-dashboard/
  - preferences/
  - preferences/change-grafana-name/
  - preferences/change-grafana-theme/
  - preferences/change-grafana-timezone/
  - preferences/change-home-dashboard/
labels:
  products:
    - enterprise
    - oss
title: Organization preferences
weight: 500
---

# Organization preferences

Grafana preferences are basic settings. They control the Grafana UI theme, home dashboard, time zone, and so on.

Preferences are sometimes confusing because they can be set at four different levels, listed from highest level to lowest:

- **Server -** Affects all users on the Grafana server. Set by a [Grafana server admin](../roles-and-permissions/#grafana-server-administrators).
- **Organization -** Affects all users in an organization. Set by an [Organization admin](../roles-and-permissions/#organization-roles).
- **Team -** Affects all users assigned to a team. Set by an Organization Admin or Team Admin. To learn more about these roles, refer to [Teams and permissions](../roles-and-permissions/#teams-and-permissions).
- **User account -** Affects the individual user. Set by the user on their own account.

The lowest level always takes precedence. For example, if a user sets their theme to **Light**, then their visualization of Grafana displays the light theme. Nothing at any higher level can override that.

If the user is aware of the change and intended it, then that's great! But if the user is a Server Admin who made the change to their user preferences a long time ago, they might have forgotten they did that. Then, if that Server Admin is trying to change the theme at the server level, they'll get frustrated as none of their changes have any effect that they can see. (Also, the users on the server might be confused, because _they_ can see the server-level changes!)

## Change Grafana name and email

In Grafana, you can change your names and emails associated with groups or accounts in the Settings or Preferences. This topic provides instructions for each task.

Some tasks require certain permissions. For more information about roles, refer to [Roles and permissions](../roles-and-permissions/).

### Change organization name

Grafana server administrators and organization administrators can change organization names.

#### Grafana Server Admin change organization name

Follow these instructions if you are a Grafana Server Admin.

1. Click **Administration** in the left-side menu.
1. Click **General**.
1. Click **Organizations**.
1. In the organization list, click the name of the organization that you want to change.
1. In **Name**, enter the new organization name.
1. Click **Update**.

#### Organization Admin change organization name

If you are an Organization Admin, follow these steps:

1. Click **Administration** in the left-side menu.
1. Click **General**.
1. Click **Default preferences**.
1. In **Organization name**, enter the new name.
1. Click **Update organization name**.

### Change team name or email

Organization administrators and team administrators can change team names and email addresses.
To change the team name or email, follow these steps:

1. Click **Administration** in the left-side menu, **Users and access**, and select **Team**.
1. In the team list, click the name of the team that you want to change.
1. Click the **Settings** tab.
1. In the Team details section, you can edit the following:
   - **Name -** Edit this field to change the display name associated with the team.
   - **Email -** Edit this field to change the email address associated with the team.
1. Click **Update**.

### Change user name or email

To learn how to edit your user information, refer to [Edit your profile](../user-management/user-preferences/#edit-your-profile).

## Change Grafana UI theme

In Grafana, you can modify the UI theme configured in the Settings or Preferences. Set the UI theme for the server, an organization, a team, or your personal user account using the instructions in this topic.

Some tasks require certain permissions. For more information about roles, refer to [Roles and permissions](../roles-and-permissions/).

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

As a Grafana server administrator, you can change the default Grafana UI theme for all users who are on the server by setting the [default_theme](../../setup-grafana/configure-grafana/#default_theme) option in the Grafana configuration file.

To see what the current settings are, refer to [View server settings](../stats-and-license/#view-server-settings).

### Change organization UI theme

Organization administrators can change the UI theme for all users in an organization.

1. Click **Administration** in the left-side menu.
1. Click **General**.
1. Click **Default preferences**.
1. In the Preferences section, select the UI theme.
1. Click **Save**.

### Change team UI theme

Organization and team administrators can change the UI theme for all users on a team.

1. Click **Administration** in the left-side menu, **Users and access**, and select **Teams**.
1. Click the team for which you want to change the UI theme.
1. Click the **Settings** tab.
1. In the Preferences section, select the UI theme.
1. Click **Save**.

### Change your personal UI theme

You can change the UI theme for your user account. This setting overrides UI theme settings at higher levels.

1. Click the user icon in the top right corner of the page and select **Profile**.
1. In the Preferences section, select the UI theme.
1. Click **Save**.

## Change the Grafana default timezone

By default, Grafana uses the timezone in your web browser. However, you can override this setting at the server, organization, team, or individual user level. This topic provides instructions for each task.

Some tasks require certain permissions. For more information about roles, refer to [Roles and permissions](../roles-and-permissions/).

### Set server timezone

Grafana server administrators can choose a default timezone for all users on the server by setting the [default_timezone](../../setup-grafana/configure-grafana/#default_timezone) option in the Grafana configuration file.

### Set organization timezone

Organization administrators can choose a default timezone for their organization.

1. Click **Administration** in the left-side menu.
1. Click **General**.
1. Click **Default preferences**.
1. Click to select an option in the **Timezone** list. **Default** is either the browser local timezone or the timezone selected at a higher level.
1. Click **Save**.

### Set team timezone

Organization administrators and team administrators can choose a default timezone for all users on a team.

1. Click **Administration** in the left-side menu, **Users and access**, and select **Teams**.
1. Click the team for which you want to change the timezone.
1. Click the **Settings** tab.
1. Click to select an option in the **Timezone** list. **Default** is either the browser local timezone or the timezone selected at a higher level.
1. Click **Save**.

### Set your personal timezone

You can change the timezone for your user account. This setting overrides timezone settings at higher levels.

1. Click the user icon in the top right corner of the page and select **Profile**.
1. Click to select an option in the **Timezone** list. **Default** is either the browser local timezone or the timezone selected at a higher level.
1. Click **Save**.

## Change the default home dashboard

The home dashboard you set is the one all users will see by default when they log in. Click the Grafana icon or **Home** in the breadcrumb to return to it. You can set the home dashboard for the server, an organization, a team, or your personal user account. This topic provides instructions for each task.

Some tasks require certain permissions. For more information about roles, refer to [Roles and permissions](../roles-and-permissions/).

### Set the home dashboard for the server

Users with the Grafana Server Admin flag on their account or access to the configuration file can define a JSON file to use as the home dashboard for all users on the server.

#### [Optional] Convert an existing dashboard into a JSON file

1. Navigate to the page of the dashboard you want to use as the home dashboard.
1. Click the **Share** button at the top right of the screen.
1. In the Export tab, click **Save to file**. Grafana converts the dashboard to a JSON file and saves it locally.

#### Use a JSON file as the home dashboard

1. Save your JSON file somewhere that Grafana can access it. For example, in the Grafana `data` folder of Grafana.
1. Update your configuration file to set the path to the JSON file. Refer to [default_home_dashboard_path](../../setup-grafana/configure-grafana/#default_home_dashboard_path) for more information about modifying the Grafana configuration files.

```ini
[dashboards]
# Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json"
default_home_dashboard_path = data/main-dashboard.json
```

{{% admonition type="note" %}}
On Linux, Grafana uses `/usr/share/grafana/public/dashboards/home.json` as the default home dashboard location.
{{% /admonition %}}

### Set the home dashboard for your organization

Organization administrators can choose a default home dashboard for their organization.

1. Navigate to the dashboard you want to set as the home dashboard.
1. Click the star next to the dashboard title to mark the dashboard as a favorite if it is not already.
1. Click **Administration** in the left-side menu.
1. Click **General**.
1. Click **Default preferences**.
1. In the **Home Dashboard** field, select the dashboard that you want to use for your home dashboard. Options include all starred dashboards.
1. Click **Save**.

### Set home dashboard for your team

Organization administrators and Team Admins can set a default home dashboard for all users on a team.

1. Navigate to the dashboard you want to set as the home dashboard.
1. Click the star next to the dashboard title to mark the dashboard as a favorite if it is not already.
1. Click **Administration** in the left-side menu, **Users and access**, and select **Teams**.
1. Click the team for which you want to change the home dashboard.
1. Click the **Settings** tab.
1. In the **Home Dashboard** field, select the dashboard that you want to use for your home dashboard. Options include all starred dashboards.
1. Click **Save**.

### Set your personal home dashboard

You can choose your own personal home dashboard. This setting overrides all home dashboards set at higher levels.

1. Navigate to the dashboard you want to set as the home dashboard.
1. Click the star next to the dashboard title to mark the dashboard as a favorite if it is not already.
1. Click the user icon in the top right corner of the page and select **Profile**.
1. In the **Home Dashboard** field, select the dashboard that you want to use for your home dashboard. Options include all starred dashboards.
1. Click **Save**.

## Change Grafana language

### Change server language

Grafana server administrators can change the default Grafana UI language for all users on the server by setting the [default_language](../../setup-grafana/configure-grafana/#default_language) option in the Grafana configuration file.

### Change organization language

Organization administrators can change the language for all users in an organization.

1. Click **Administration** in the left-side menu.
1. Click **General**.
1. Click **Default preferences**.
1. In the Preferences section, select an option in the **Language** dropdown.
1. Click **Save**.

### Change team language

Organization and team administrators can set a default language for all users on a team.

1. Click **Administration** in the left-side menu, **Users and access**, and select **Teams**.
1. Click the team for which you want to change the language.
1. Click the **Settings** tab.
1. In the Preferences section, select an option in the **Language** dropdown.
1. Click **Save**.

### Change your personal language

You can change the language for your user account. This setting overrides language settings at higher levels.

1. Click the user icon in the top right corner of the page and select **Profile**.
1. In the Preferences section, select an option in the **Language** dropdown.
1. Click **Save**.
