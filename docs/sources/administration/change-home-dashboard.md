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

You can change the default homepage of Grafana in two different ways: change Grafana preferences or change the Grafana configuration.

## Change home dashboard preference

You can choose any of your existing Grafana dashboards to replace the default home dashboard in the preferences.

Only administrators can change organization preferences and they affect all the users in the organization. Changing your own user preferences only affects you.
User preferences override organization preferences. 

1. Go to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title. 
1. *[Organization preferences]* In **Configuration > Preferences**, select your starred dashboard in the **Home Dashboard** field. 
1. *[User preferences]* Hover your avatar in the bottom left corner of Grafana and click on **Preferences**. Select your starred dashboard in the **Home Dashboard** field. 

## Change home dashboard configuration

If preferences are set as described above, then they override this value.

You can provide your own JSON file to change the home dashboard. No user will be able to update this dashboard in Grafana.

### [Optional] Convert an existing dashboard into a JSON file
1. Go to your dashboard page
1. Click on the **Share dashboard** button next to the dashboard title
1. Go to the **Export** tab and click on **Save to file**

### Use a JSON file as the home dashboard
1. Save your JSON file on disk, for example in the *data* folder of Grafana. 
1. Update your [configuration]({{< relref "./configuration.md">}}) file to set the path to the JSON file:
```ini
[dashboards]
# Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json"
default_home_dashboard_path = data/main-dashboard.json
```
