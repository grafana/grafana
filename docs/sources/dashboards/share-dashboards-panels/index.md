---
aliases:
  - ../administration/reports/
  - ../enterprise/export-pdf/
  - ../enterprise/reporting/
  - ../reference/share_dashboard/
  - ../reference/share_panel/
  - ../share-dashboards-panels/
  - ../sharing/
  - ../sharing/playlists/
  - ../sharing/share-dashboard/
  - ../sharing/share-panel/
  - ./
  - reporting/
  - share-dashboard/
keywords:
  - grafana
  - dashboard
  - documentation
  - share
  - panel
  - library panel
  - playlist
  - reporting
  - export
  - pdf
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Sharing
title: Share dashboards and panels
description: Share Grafana dashboards and panels within your organization and publicly
weight: 85
refs:
  image-rendering:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/
  grafana-enterprise:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
---

# Share dashboards and panels

Grafana enables you to share dashboards and panels with other users within an organization and in certain situations, publicly on the Web. You can share using:

- A direct link
- A Snapshot
- An embedded link (for panels only)
- An export link (for dashboards only)
- A report

<!-- has any of the information in these next 3 sentences changed? -->

You must have an authorized viewer permission to see an image rendered by a direct link.

The same permission is also required to view embedded links unless you have anonymous access permission enabled for your Grafana instance.

{{< admonition type="note" >}}
As of Grafana 8.0, anonymous access permission is not available in Grafana Cloud.
{{< /admonition >}}

## Share a dashboard

You can share dashboards in the following ways:

- Internally with a link
- Externally with a link (to anyone)
- Externally by email (to specific people)
- As a snapshot
- As a report
- As a JSON file

When you share a dashboard externally as a link or by email, those dashboards are included a list of your public dashboards. To view the list and manage these dashboards, navigate to **Dashboards > Public dashboards**.

<!-- image of list here -->

### Share internally

Share a personalized, direct link to your dashboard within your organization.

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down in the top-right corner and select **Share internally**.
1. (Optional) Set the following options (they're enabled by default):
   - **Lock time range** - Change the current relative time range to an absolute time range.
   - **Shorten link** - Shorten the dashboard link.
1. Select the **Current**, **Dark**, or **Light** theme for the dashboard.
1. Click **Copy link**.
1. Send the copied link to a Grafana user with authorization to view the link.
1. Click the **X** at the top-right corner to close the share drawer.

### Share externally with specific people

To share with specific external users, you can send them a link by email. Use this option when you only want to share your dashboard with specific people instead of anyone who navigates to the link. Sharing a link by email creates a 30-day token associated with that external user.

When you share a dashboard with an email link, your organization is billed per user for the duration of the 30-day token, regardless of how many dashboards are shared. Billing stops after 30 days unless you renew the token.

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down in the top-right corner and select **Share externally**.
1. In the **Link access** drop-down, select **Anyone with the link**.
1. Click the checkbox confirming that you understand payment is required to add users.
1. Click **Accept**.
1. In the **Invite** field, enter the email address of the person you want to invite and click **Invite**.

   You can only invite one person at a time.

1. (Optional) Set the following options:
   - **Enable time range** - Allow people accessing the link to change the time range. This configuration screen shows the default time range of the dashboard.
   - **Display annotations** - Allow people accessing the link to view the dashboard annotations.
1. Click **Copy external link**.
1. Send the copied URL to any external user.
1. Click the **X** at the top-right corner to close the share drawer.

### Share externally to anyone with a link

To share your dashboard so that anyone with the link can access it, follow these steps.

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down in the top-right corner and select **Share externally**.
1. In the **Link access** drop-down, select **Anyone with the link**.
1. Click the checkbox confirming that you understand the entire dashboard will be public.
1. Click **Accept**.
1. (Optional) Set the following options:
   - **Enable time range** - Allow people accessing the link to change the time range. This configuration screen shows the default time range of the dashboard.
   - **Display annotations** - Allow people accessing the link to view the dashboard annotations.
1. Each recipient will receive an email with link to the dashboard that's valid for 30 days.
1. Click the **X** at the top-right corner to close the share drawer.

### Update access to an external dashboard link

You can update the access to externally shared dashboard links by following these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down in the top-right corner and select **Share externally**.
1. Do one of the following:
   - Click **Pause access** so that people can't access the dashboard, but the link is maintained.
   - Click **Resume access** so that people can access the dashboard again.
   - Click **Revoke access** so that people can't access the dashboard unless a new external link is generated. Confirm that you want to revoke the link.
1. Click the **X** at the top-right corner to close the share drawer.

### Schedule a report

To share your dashboard as a report, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down in the top-right corner and select **Schedule a report**.
1. [Configure the report](ref:configure-report).
1. Depending on your schedule settings, click **Schedule send** or **Send now**.

You can also save the report as a draft.

To manage your reports, navigate to **Dashboards > Reporting > Reports**.

### Share a snapshot

A dashboard snapshot publicly shares a dashboard while removing sensitive data such as queries and panel links, leaving only visible metrics and series names. Anyone with the link can access the snapshot.

<!-- is the following para still true? -->

You can publish snapshots to your local instance or to [snapshots.raintank.io](http://snapshots.raintank.io). The latter is a free service provided by Grafana Labs that enables you to publish dashboard snapshots to an external Grafana instance. Anyone with the link can view it. You can set an expiration time if you want the snapshot removed after a certain time period.

To share your dashboard with anyone as a snapshot, follow these steps.

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down in the top-right corner and select **Share snapshot**.
1. In the **Snapshot name** field, enter a descriptive title for the snapshot.
1. Select one of the following expiration options for the snapshot:
   - **1 Hour**
   - **1 Day**
   - **1 Week**
   - **Never**
1. Click **Publish snapshot**.
1. (Optional) If you want to see the other snapshots shared from your organization, click the **View all snapshots** link.

   You can also navigate to **Dashboards > Snapshots** in the primary menu.

1. Click the **X** at the top-right corner to close the share drawer.

### Delete a snapshot

To delete existing snapshots, follow these steps:

1. Navigate to **Dashboards > Snapshots** in the main menu.
1. Click the red **x** next to the snapshot that you want to delete.

The snapshot is immediately deleted. You may need to clear your browser cache or use a private or incognito browser to confirm this.

### Export a dashboard as JSON

The dashboard export action creates a Grafana JSON file that contains everything you need, including layout, variables, styles, data sources, queries, and so on, so that you can later import the dashboard.

1. Click **Dashboards** in the main menu.
1. Open the dashboard you want to export.
1. Click the **Export** drop-down in the top-right corner and select **Export as JSON**.
1. If you're exporting the dashboard to use in another instance, with different data source UIDs, enable the **Export for sharing externally** switch.
1. Click **Download file** or **Copy to clipboard**.
1. Click the **X** at the top-right corner to close the share drawer.

## Share a panel

You can share a panel as a direct link, as a snapshot, or as an embedded link. You can also create library panels using the **Share** option on any panel.

1. Hover over any part of the panel to display the actions menu on the top right corner.
1. Click the menu and select **Share**.

   The share dialog opens and shows the **Link** tab.

### Use direct link

The **Link** tab shows the current time range, template variables, and the default theme. You can optionally enable a shortened URL to share.

1. Click **Copy**.

   This action copies the default or the shortened URL to the clipboard.

1. Send the copied URL to a Grafana user with authorization to view the link.
1. You also optionally click **Direct link rendered image** to share an image of the panel.

For more information, refer to [Image rendering](ref:image-rendering).

The following example shows a link to a server-side rendered PNG:

```bash
https://play.grafana.org/d/000000012/grafana-play-home?orgId=1&from=1568719680173&to=1568726880174&panelId=4&fullscreen
```

#### Query string parameters for server-side rendered images

- **width:** Width in pixels. Default is 800.
- **height:** Height in pixels. Default is 400.
- **tz:** Timezone in the format `UTC%2BHH%3AMM` where HH and MM are offset in hours and minutes after UTC
- **timeout:** Number of seconds. The timeout can be increased if the query for the panel needs more than the default 30 seconds.
- **scale:** Numeric value to configure device scale factor. Default is 1. Use a higher value to produce more detailed images (higher DPI). Supported in Grafana v7.0+.

### Publish a snapshot

A panel snapshot shares an interactive panel publicly. Grafana strips sensitive data leaving only the visible metric data and series names embedded in the dashboard. Panel snapshots can be accessed by anyone with the link.

You can publish snapshots to your local instance or to [snapshots.raintank.io](http://snapshots.raintank.io). The latter is a free service provided by [Grafana Labs](https://grafana.com), that enables you to publish dashboard snapshots to an external Grafana instance.

{{< admonition type="note" >}}
As of Grafana 11, the option to publish to [snapshots.raintank.io](http://snapshots.raintank.io) is no longer available for Grafana Cloud.
{{< /admonition >}}

You can optionally set an expiration time if you want the snapshot to be removed after a certain time period.

1. In the **Share Panel** dialog, click **Snapshot** to go to the tab.
1. Click **Publish to snapshots.raintank.io** or **Publish Snapshot**.

   Grafana generates the link of the snapshot.

1. Copy the snapshot link, and share it either within your organization or publicly on the web.

If you created a snapshot by mistake, click **Delete snapshot** in the dialog box to remove the snapshot from your Grafana instance.

#### Delete a snapshot

To delete existing snapshots, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click **Snapshots** to go to the snapshots management page.
1. Click the red **x** next to the snapshot URL that you want to delete.

The snapshot is immediately deleted. You may need to clear your browser cache or use a private or incognito browser to confirm this.

### Embed panel

You can embed a panel using an iframe on another web site. A viewer must be signed into Grafana to view the graph.

{{< admonition type="note" >}}
As of Grafana 8.0, anonymous access permission is no longer available for Grafana Cloud.
{{< /admonition >}}

Here is an example of the HTML code:

```html
<iframe
  src="https://snapshots.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4"
  width="650"
  height="300"
  frameborder="0"
></iframe>
```

The result is an interactive Grafana graph embedded in an iframe.

### Library panel

To create a library panel from the **Share Panel** dialog:

1. Click **Library panel**.
1. In **Library panel name**, enter the name.
1. In **Save in folder**, select the folder in which to save the library panel. By default, the root level is selected.
1. Click **Create library panel** to save your changes.
1. Click **Save dashboard**.
