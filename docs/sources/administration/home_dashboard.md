+++
title = "How to replace the default home dashboard"
description = "How to replace the default home dashboard"
keywords = ["grafana", "configuration", "documentation", "home"]
type = "docs"
[menu.docs]
name = "Home Dashboard"
identifier = "home-dashboard"
parent = "admin"
weight = 100
+++

# How to replace the default home dashboard

You can easily replace the default homepage of Grafana in two different ways.

## Preferences

You can choose any of your existing Grafana dashboards to replace the default home dashboard in the preferences. First, you need to star the dashboard that you want to use. Then, in `Configuration > Preferences`, you can select one of your starred dashboards in the `Home Dashboard` input. It will set it for all the users in your organization.

You can also replace it for you only by updating your own preferences.

If you change the home dashboard in both preferences, user preferences will override organization preferences. 


## Configuration

You can also provide your own JSON file and set the path to this file in the [configuration]({{< relref "./configuration.md">}}) file.

```ini
[dashboards]
# Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json"
default_home_dashboard_path =
```

If preferences are set as described above, they will override this value.
