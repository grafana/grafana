+++
title = "License Restrictions"
description = "Grafana Enterprise license restrictions"
keywords = ["grafana", "licensing", "enterprise"]
weight = 9
+++

# License restrictions

Enterprise licenses are limited by the number of active viewers, the number of active editor/admins, a license expiration date, and the URL of the Grafana instance.

**User limits**

Grafana licenses allow a certain number of active users in an instance. An active user is any user that has signed in to Grafana within the past 30 days. 

Each user is classified as either Viewer or an Editor/Admin. 

- All users who have the ability to edit and save dashboards are considered “Editors/Admins”, which includes: 
    - Grafana server admins
    - Users assigned an Org role of "Editor" or "Admin," 
    - Users that have been granted "Admin" or "Edit" permissions through [dashboard/folder permissions](https://grafana.com/docs/grafana/latest/permissions/dashboard_folder_permissions/). 
- Viewers are users with the Viewer role who do not have the permissions to save dashboards.

Editors and admins are counted the same from a licensing perspective. Restrictions are applied separately for Viewers and for Editor/Admins. 

When the number of maximum active Viewers or Editor/Admins is reached, a warning banner is displayed within Grafana.

**Expiration date**

The license expiration date is the day when a license is no longer active. A banner will appear in Grafana Enterprise when the license expiration date approaches.

**License URL**

License URL is the root URL of your Grafana instance. The license will not work on an instance of Grafana with a different root URL.

## Updating license restrictions

To increase the number of licensed users within Grafana, extend a license, or change your Licensed URL, contact [Grafana support](https://grafana.com/profile/org#support) or your Grafana Labs account team. They will update your license, and you can apply the updated license within Grafana following the [Activate a license process](https://grafana.com/docs/grafana/latest/enterprise/activate-license/).
