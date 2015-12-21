----
page_title: Dashboard Metadata
page_description: Grafana dashboard metadata
page_keywords: grafana, metadata, documentation
---

# Dashboard Metadata

Grafana is now capable of showing metadata and last update information of a dashboard. This metadata is available under the following menu:
**"Manage dashboard > Settings > Metadata"** tab:

* Last Updated at: Shows the timestamp when was the last time the dashboard was updated.
* Created at: Shows the timestamp when was the dashboard was created.
* Last Updated by: Shows the user information who last updated the dashboard.

## Time format:

Currently, the timestamp for **Last Updated at** and **Created at** fields is shown in the following format:
* MMM Do YYYY, h:mm:ss a ; For example: Dec 18th 2015, 3:29:17 am

## User Identification:

User is identified by its login ID currently and that is displayed under **Last Updated by** metadata field. If anonymous access is enabled and an anonymous user updates a dashboard, then the **Last updated by** metadata field will show value as "Anonymous".
