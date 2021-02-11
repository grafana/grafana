+++
title = "Change home dashboard"
description = "How to replace the default home dashboard"
keywords = ["grafana", "configuration", "documentation", "home"]
aliases = ["/docs/grafana/latest/administration/change-home-dashboard/"]
weight = 300
+++

# Change the default home dashboard

The home dashboard you set is the one all users will see by default when they log in. You can set the home dashboard for the server, an organization, a team, or your personal user account. The lowest level always takes precedence.

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
1. Update your configuration file to set the path to the JSON file. Refer to [default_home_dashboard_path]({{< relref "../configuration.md">}}) for more information about modifying the Grafana configuration files.

```ini
[dashboards]
# Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json"
default_home_dashboard_path = data/main-dashboard.json
```

## Set the home dashboard for your organization

Organization administrators can choose a home dashboard for their organization.

1. Navigate to the dashboard you want to set as the home dashboard.
1. Click the star next to the dashboard title to mark the dashboard as a favorite if it is not already.
1. On the left menu, hover your cursor over the **Configuration** (gear) icon and then click **Preferences**.
1. In the **Home Dashboard** field, select the dashboard that you want to use for your home dashboard. Options include all starred dashboards.

## Set home dashboard for your team

Organization administrators and Team Admins can choose a home dashboard for a team.

1. Navigate to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title.
1. On the left menu, hover your cursor over the **Configuration** (gear) icon and then click **Teams**.
1. Click on the team you want to change the home dashboard for and then navigate to the **Settings** tab.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards.

## Set your personal home dashboard

You can choose your own personal home dashboard. This setting overrides all home dashboards set at higher levels.

1. Navigate to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title.
1. On the left menu, hover your cursor over your avatar and then click **Preferences**.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards.
