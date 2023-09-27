+++
title = "License restrictions"
description = "Grafana Enterprise license restrictions"
keywords = ["grafana", "licensing", "enterprise"]
weight = 110
+++

# License restrictions

Enterprise licenses are limited by the number of active users, a license expiration date, and the URL of the Grafana instance.

## User limits

Grafana licenses allow for a certain number of active users per instance. An active user is any user that has signed in to Grafana within the past 30 days.

In the context of licensing, each user is classified as either a viewer or an editor:

- An editor is a user who has permission to edit and save a dashboard. Examples of editors are as follows:
    - Grafana server administrators.
    - Users who are assigned an organizational role of Editor or Admin.
    - Users that have been granted Admin or Edit permissions at the dashboard or folder level. Refer to [Dashboard and folder permissions](https://grafana.com/docs/grafana/latest/permissions/dashboard_folder_permissions/).     
- A viewer is a user with the Viewer role, which does not permit the user to save a dashboard.

Restrictions are applied separately for viewers and editors.

When the number of maximum active viewers or editors is reached, Grafana displays a warning banner.

Sometimes it is useful to log in to an account from multiple locations concurrently. With Grafana Enterprise 7.5 and up, accounts are limited to three concurrent sessions.

## Expiration date

The license expiration date is the date when a license is no longer active. As the license expiration date approaches, Grafana Enterprise displays a banner.

## License URL

License URL is the root URL of your Grafana instance. The license will not work on an instance of Grafana with a different root URL.

## Download a dashboard and folder permissions report

This CSV report helps to identify users, teams, and roles that have been granted Admin or Edit permissions at the dashboard or folder level.

To download the report:
1. Hover your cursor over the **Server Admin** (shield) icon in the side menu and then click **Licensing**.
2. At the bottom of the page, click **Download report**.

## Update license restrictions

To increase the number of licensed users within Grafana, extend a license, or change your licensed URL, contact [Grafana support](https://grafana.com/profile/org#support) or your Grafana Labs account team. They will update your license, which you can activate from within Grafana. 

For instructions on how to activate your license after it is updated, refer to 
[Activate an Enterprise license]({{< relref "./activate-license.md" >}})
