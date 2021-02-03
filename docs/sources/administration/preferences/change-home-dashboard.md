+++
title = "Change the default home dashboard"
description = "How to replace the default home dashboard"
keywords = ["grafana", "configuration", "documentation", "home"]
aliases = ["/docs/grafana/latest/administration/change-home-dashboard/"]
weight = 100
+++

# Change the default home dashboard

The home dashboard you set is the one all users will see by default when they log in. You can set the home dashboard at four different levels. Listed in order from highest to lowest, they are:

- Server
- Organization
- Team
- User account

The lowest level always takes precedence.

## Set the home dashboard for the server

Users with the Grafana Server Admin flag on their account or access to the configuration file can define a JSON file to use as the home dashboard for all users on the server.

### [Optional] Convert an existing dashboard into a JSON file

1. Navigate to your dashboard page.
1. Click the **Share dashboard** icon next to the dashboard title.
1. In the **Export** tab, click on **Save to file**.

### Use a JSON file as the home dashboard

1. Save your JSON file somewhere that Grafana can access it. For example, in the Grafana `data` folder of Grafana.
1. Update your configuration file to set the path to the JSON file. Read how to update this file in the [configuration]({{< relref "./configuration.md">}}) documentation.

```ini
[dashboards]
# Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json"
default_home_dashboard_path = data/main-dashboard.json
```

## Set the home dashboard for your organization


1. Navigate to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title.
1. On the left menu, hover your cursor over the **Configuration** (gear) icon and then click **Preferences**.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards.

## Set home dashboard for your team


1. Navigate to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title.
1. On the left menu, hover your cursor over the **Configuration** (gear) icon and then click **Teams**.
1. Click on the team you want to change the home dashboard for and then navigate to the **Settings** tab.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards.

## Set your personal home dashboard



1. Navigate to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title.
1. On the left menu, hover your cursor over your avatar and then click **Preferences**.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards.
