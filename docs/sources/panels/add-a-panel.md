+++
title = "Add a panel"
type = "docs"
[menu.docs]
identifier = "add-a-panel"
parent = "panels"
weight = 100
draft = "true"
+++

# Add a panel

Panels allow you to show your data in visual form. This topic walks you through the most basic steps to build a panel.

## 1. Add a panel to a dashboard

1. Navigate to the dashboard you want to add a panel to.
1. Click the **Add panel** icon.
   
   ![](/img/docs/panels/add-panel-icon-7-0.png)

2. Click **Add new panel**.

Grafana creates an empty graph panel with your default data source selected.

## 2. Edit panel settings

While not required, we recommend that you add a helpful title and description to your panel. You can use variables you have defined in either field, but not global variables.

[Panel settings screenshot]

**Panel title -** Text entered in this field is displayed at the top of your panel in the Panel editor and in the dashboard.

**Description -** Write a description of the panel and the data you are displaying. Pretend you are explaining it to a new user six months from now, when it is no longer fresh in your mind. Future editors (possibly yourself) will thank you.

## 3. Write a query

Each panel needs at least one query to display a visualization. You write queries in the Query tab of the Panel editor. 
Choose a data source. In the first line of the Query tab, click the drop-down list to see all available data sources. This list includes all data sources you added.
Write or construct a query in the query language of your data source. Options will vary. Refer to your specific [data source documentation](LINK) for specific guidelines.

For more information about the Query tab, refer to [Queries](LINK).

## 4. Choose a visualization type

Preview visualizations, filter, don’t use deprecated. Link to wherever we have panel types. Mention display options, they are different depending on panel type.

## 5. Apply changes and save

Explain importance of applying changes and saving dashboard.

## What next?

Our Grafana Fundamentals tutorial is a great place to start, or you can learn more about Grafana by reading one of the documentation topics linked below:

Learn more Panel editor options.
Add more queries.
Transform your data.
Change how your data are displayed in the visualization.
Set up an alert.
Create templates and variables.
