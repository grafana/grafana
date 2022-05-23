+++
aliases = ["/docs/grafana/latest/administration/change-home-dashboard/", "/docs/grafana/latest/administration/preferences/change-home-dashboard/"]
description = "How to replace the default home dashboard"
keywords = ["grafana", "configuration", "documentation", "home"]
title = "Change home dashboard"
weight = 300
+++

# Change the default home dashboard

The home dashboard you set is the one all users will see by default when they log in. You can set the home dashboard for the server, an organization, a team, or your personal user account. This topic provides instructions for each task.

{{< docs/shared "preferences/some-tasks-require-permissions.md" >}}

## Navigate to the home dashboard

The home dashboard is the first dashboard a user sees when they sign in to Grafana. You can also navigate to the home dashboard manually.

1. Hover your cursor over the **Dashboards** (four squares) icon.
1. Click **Home**.

## Set the home dashboard for the server

Users with the Grafana Server Admin flag on their account or access to the configuration file can define a JSON file to use as the home dashboard for all users on the server.

### [Optional] Convert an existing dashboard into a JSON file

1. Navigate to the page of the dashboard you want to use as the home dashboard.
1. Click the **Share dashboard** icon next to the dashboard title.
1. In the Export tab, click **Save to file**. Grafana converts the dashboard to a JSON file and saves it locally.

### Use a JSON file as the home dashboard

1. Save your JSON file somewhere that Grafana can access it. For example, in the Grafana `data` folder of Grafana.
1. Update your configuration file to set the path to the JSON file. Refer to [default_home_dashboard_path]({{< relref "../configuration.md#default_home_dashboard_path" >}}) for more information about modifying the Grafana configuration files.

```ini
[dashboards]
# Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json"
default_home_dashboard_path = data/main-dashboard.json
```

> **Note:** On Linux, Grafana uses `/usr/share/grafana/public/dashboards/home.json` as the default home dashboard location.

## Set the home dashboard for your organization

Organization administrators can choose a home dashboard for their organization.

{{< docs/list >}}
{{< docs/shared "preferences/navigate-to-the-dashboard-list.md" >}}
{{< docs/shared "preferences/org-preferences-list.md" >}}
{{< docs/shared "preferences/select-home-dashboard-list.md" >}}
{{< /docs/list >}}

## Set home dashboard for your team

Organization administrators and Team Admins can choose a home dashboard for a team.

{{< docs/list >}}
{{< docs/shared "preferences/navigate-to-the-dashboard-list.md" >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click on the team that you want to change the home dashboard for and then navigate to the **Settings** tab.
   {{< docs/shared "preferences/select-home-dashboard-list.md" >}}
   {{< /docs/list >}}

## Set your personal home dashboard

You can choose your own personal home dashboard. This setting overrides all home dashboards set at higher levels.

{{< docs/list >}}
{{< docs/shared "preferences/navigate-to-the-dashboard-list.md" >}}
{{< docs/shared "preferences/navigate-user-preferences-list.md" >}}
{{< docs/shared "preferences/select-home-dashboard-list.md" >}}
{{< /docs/list >}}
