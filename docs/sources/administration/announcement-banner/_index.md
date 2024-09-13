---
keywords:
  - grafana
  - announcement
labels:
  products:
    - cloud
    - enterprise
menuTitle: Announcement banner
title: Create and configure announcement banner
description: How to create an announcement banner to show important updates and information at the top of every Grafana page.
---

# Create an announcement banner

An announcement banner shows at the top of every page in Grafana. You can use the announcement banner to communicate information to your users, such as maintenance windows, new features, or other important updates.

## Create or update an announcement banner

By default, only organization administrators can create announcement banners. You can customize who can create announcement banners with [Role-based access control](/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/).

To create or update an announcement banner, follow these steps:

1. Click **Administration > General > Announcement banner** in the side navigation menu.

   The **Announcement banner** page allows you to view, create, and update the settings for an announcement banner.
   Only one banner can be active at a time.

1. Toggle the **Enable** switch on to enable the announcement banner.
   You can disable the banner at any time with this toggle.
1. Enter the **Message** for the announcement banner.
   The message field supports Markdown.

   To add a header, use the following syntax:

   ```markdown
   ### Header
   ```

   To add a link, use the following syntax:

   ```markdown
   [link text](https://www.example.com)
   ```

   The preview of the configured banner appears on top of the form, under the **Preview** section.

1. Select the banner's start date and time in the **Starts at** field.
   By default, the banner starts being displayed immediately.
   You can set a future date and time for the banner to start displaying.
1. Select the banner's end date and time in the **Ends at** field.
   By default, the banner is displayed indefinitely.
   You can set a date and time for the banner to stop displaying.
1. Select the type of banner in the **Variant** field.
   This determines the color of the banner's background.
1. Click **Save** to save the banner settings.
   The banner displays at the top of every page in Grafana between the start and end dates.
