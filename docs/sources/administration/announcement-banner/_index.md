---
draft: false
aliases:
  - ../administration/reports/
  - ../enterprise/export-pdf/
  - ../enterprise/reporting/
  - ../panels/create-reports/
  - reporting/
keywords:
  - grafana
  - announcement
labels:
  products:
    - cloud
    - enterprise
menuTitle: Announcement banner
title: Create and configure announcement banner
description: Creat a banner to show important updates and information at the top of on every page
refs:
  rbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
---

# Create and configure announcement banner

Announcement banner allows you to show important updates and information at the top of every page in Grafana. You can use the announcement banner to communicate important information to your users, such as maintenance windows, new features, or other important updates.

## Create or update an announcement banner

Only organization administrators can create announcement banner by default. You can customize who can create announcement banner with [Role-based access control](ref:rbac).

To create or update an announcement banner, follow these steps:

1. Click **Administration > General > Announcement banner** in the side navigation menu.

   The Announcement banner page allows you to view, create and update the settings for a notification banner. Only one banner can be created at a time.

2. Toggle the **Enable** switch on to enable the announcement banner. It can be toggled off at any time to disable the banner.

3. Enter the **Message** for the announcement banner.

   The message field supports Markdown. To add a header, use the following syntax:

   ```markdown
   ### Header
   ```

   To add a link, use the following syntax:

   ```markdown
   [link text](https://www.example.com)
   ```

   The preview of the configured banner will appear on top of the form, under the **Preview** section.

4. Select the banner's start date and time in the **Starts** field.

   By default, the banner starts being displayed immediately. You can set a future date and time for the banner to start displaying.

5. Select the banner's end date and time in the **Ends** field.

   By default, the banner is displayed indefinitely. You can set a future date and time for the banner to stop displaying.

6. Select the banner's visibility.

   **Everyone** - The banner is visible to all users, including on login page.

   **Authenticated users** - The banner is visible to only authenticated users.

7. Select the type of banner in the **Variant** field.

   This will determine the color of the banner's background.

8. Click **Save** to save the banner settings.

   The banner will now be displayed at the top of every page in Grafana.
