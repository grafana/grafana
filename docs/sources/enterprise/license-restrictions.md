+++
title = "License Restrictions"
description = "Grafana Enterprise license restrictions"
keywords = ["grafana", "licensing", "enterprise"]
weight = 8
+++

# License restrictions

Enterprise licenses are limited by the number of active users, a license expiration date, and the URL of the Grafana instance.

**User limits**

Grafana licenses allow a certain number of active users in an instance. An active user is any user that has signed in to Grafana within the past 30 days.

In the context of licensing, each user is classified as either a viewer or an editor, which are defined as follows:

- An editor is a user who has the ability to edit and save dashboards, which includes:
    - Grafana server admins
    - Users assigned an Org role of "Editor" or "Admin," 
    - Users that have been granted "Admin" or "Edit" permissions through [dashboard/folder permissions](https://grafana.com/docs/grafana/latest/permissions/dashboard_folder_permissions/).     
- A viewer is a user with the Viewer role who does not have the permissions to save dashboards.

Restrictions are applied separately for viewers and editors.

When the number of maximum active viewers or editors is reached, a warning banner is displayed within Grafana.

**Expiration date**

The license expiration date is the day when a license is no longer active. A banner will appear in Grafana Enterprise when the license expiration date approaches.

**License URL**

License URL is the root URL of your Grafana instance. The license will not work on an instance of Grafana with a different root URL.

## Updating license restrictions

To increase the number of licensed users within Grafana, extend a license, or change your Licensed URL, contact [Grafana support](https://grafana.com/profile/org#support) or your Grafana Labs account team. They will update your license, and you can apply the updated license within Grafana following the [Activate a license process](https://grafana.com/docs/grafana/latest/enterprise/activate-license/).
