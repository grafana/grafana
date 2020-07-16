+++
title = "Change the default home dashboard"
description = "How to replace the default home dashboard"
keywords = ["grafana", "configuration", "documentation", "home"]
type = "docs"
[menu.docs]
name = "Home Dashboard"
identifier = "change-home-dashboard"
parent = "admin"
weight = 100
+++

# Change the default home dashboard

You can change the home dashboard of Grafana in two different ways: change Grafana preferences or change the Grafana configuration. You can change it for you, for your team or for your whole organization depending on the method you choose. Each method below describes which users are affected by your action.

## Change home dashboard preference

You can choose any of your existing Grafana dashboards to replace the default home dashboard in the preferences.

### Set home dashboard for your organization

This procedure changes the home dashboard for all users in your organization. Individual user and team preferences override it.

1. Go to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title.
1. On the left menu, hover your cursor over the **Configuration** (gear) icon and then click **Preferences**.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards.


### Set home dashboard for your team

This procedure changes the home dashboard for all users in a team. It overrides organization preferences. Individual user preferences override it.
1. Go to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title. 
1. On the left menu, hover your cursor over the **Configuration** (gear) icon and then click **Teams**.
1. Click on the team you want to change the home dashboard for and then navigate to the **Settings** tab.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards. 

### Set your personal home dashboard

This procedure only changes your home dashboard. It overrides organization and team preferences.

1. Go to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title. 
1. On the left menu, hover your cursor over your avatar and then click **Preferences**.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards. 

## Change home dashboard configuration

If preferences are set as described above, then they override this value.

You can provide your own JSON file to change the home dashboard. No user will be able to update this dashboard in Grafana.

### [Optional] Convert an existing dashboard into a JSON file
1. Navigate to your dashboard page.
1. Click the **Share dashboard** icon next to the dashboard title.
1. In the **Export** tab, click on **Save to file**.

### Use a JSON file as the home dashboard
1. Save your JSON file on disk, for example, in the Grafana `data` folder of Grafana. 
1. Update your configuration file to set the path to the JSON file. Read how to update this file in the [configuration]({{< relref "./configuration.md">}}) documentation.
```ini
[dashboards]
# Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json"
default_home_dashboard_path = data/main-dashboard.json
```
