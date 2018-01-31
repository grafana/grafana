+++
title = "What's New in Grafana v5.0"
description = "Feature & improvement highlights for Grafana v5.0"
keywords = ["grafana", "new", "documentation", "5.0"]
type = "docs"
[menu.docs]
name = "Version 5.0"
identifier = "v5.0"
parent = "whatsnew"
weight = -6
+++

# What's New in Grafana v5.0

Grafana v5.0 is here and with it comes a new dashboard engine and the new feature: Dashboard folders. Grafana has never looked this good.

## New dashboard engine

The new grid system for the dashboards are more flexible than ever and are no longer dependent on rows. The panels can be organized in any way you want simply by dragging and dropping and stretching and contracting.

The rows are still there but have taken on a new role. You now use rows to group and hide your panels. You still organize your panels as you want in rows.

## UX improvements

Grafana v5.0 brings big changes to UX/UI.
There is now a dashboard settings page.

{{< docs-imagebox img="/img/docs/v50/v5_dashboard_settings.png" max-width="700px" >}}

## Dashboard folders

The big new feature that comes with Grafana v5.0 is Dashboard folders. Now you can organize your dashbords into folders which is very useful if you have a lot of dashboards or multiple teams using the same Grafana instance.

Each folder has its own page where you can set permisions for the folder or single dashboards within the folder. Here you can also delete and move dashboards.

## Teams

Teams are a new concept for Grafana. Teams are simply a group of users that can be given permissions for folders or dashboards. Only an admin can create teams.

# Dashboard model

We are introducing a new identifier in the dashboard JSON model. The new identifier will be a X long uid. We are also changing the route for getting dashboards to use this id instead (we will keep supporting the old route for backward compatibility). This will make it possible to change the title on dashboards without breaking links. Sharing dashboards between instances become much easier since the uid is unique (unique enough) and the old numeric id always depends on the instance and might cause a conflict. This might seem like a small change, but we are incredibly excited about it since it will make it much easier to manage, collaborate and navigate between dashboards

# Provisioning Grafana from configuration

In previous versions of Grafana, you could use the API for provisioning. But that required the service to be running before you started creating dashboards and you also needed to set up credentials for authentication. In 5.0 we decided to improve this experience and enable people to provision using config files instead. Not only will this make gitops more natural, and it will also allow people to run Grafana as a stateless application.

In 5.0 we added support for provisioning data sources and dashboards. We will add support for provisioning more parts of Grafana in the future.

## Data sources

It's now possible to create data sources in Grafana only using config files. These data sources are by default not editable from the Grafana GUI. Its also possible to update and delete data sources from the config, which makes it possible to manage data sources only thru configuration. More info in the [data source provisioning docs](/administration/provisioning/#datasources)

## Dashboards

We also deprecated [dashboard.json] in favor of our new dashboard provisioner that keeps dashboards on disk in sync with Grafana. The dashboard provisioner have multiple advantages over the old [dashboard.json] feature. Instead of storing the dashboard in memory we now insert the dashboard into the database, which makes it possible to use it with dashboard folders, permissions, built-in annotations and other features in Grafana that expects the dashboards to exist in the database. More info in the [dashboard provisioning docs](/administration/provisioning/#dashboards)