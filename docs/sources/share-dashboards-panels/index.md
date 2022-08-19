---
aliases:
  - /docs/grafana/latest/sharing/
  - /docs/grafana/latest/dashboards/share-dashboard/
  - /docs/grafana/latest/reference/share_dashboard/
  - /docs/grafana/latest/sharing/share-dashboard/
  - /docs/grafana/latest/dashboards/share-dashboard/
  - /docs/grafana/latest/reference/share_panel/
  - /docs/grafana/latest/sharing/share-panel/
  - /docs/grafana/latest/sharing/playlists/
  - /docs/grafana/latest/administration/reports/
  - /docs/grafana/latest/enterprise/reporting/
  - /docs/grafana/latest/administration/reports/
  - /docs/grafana/latest/dashboards/reporting/
  - /docs/grafana/latest/enterprise/export-pdf/
title: Share dashboards and panels
menuTitle: Share dashboards and panels
weight: 85
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
---

# Share dashboards and panels

Grafana enables you to share dashboards and panels with other users within an organization and in certain situations, publicly on the Web. You can share using:

- A direct link
- A Snapshot
- An embedded link (for panels only)
- An export link (for dashboards only)

You must have an authorized viewer permission to see an image rendered by a direct link.

The same permission is also required to view embedded links unless you have anonymous access permission enabled for your Grafana instance.

\*> Note:\*\* As of Grafana 8.0, anonymous access permission is not available in Grafana Cloud.

When you share a panel or dashboard as a snapshot, a snapshot (which is a panel or dashboard at the moment you take the snapshot) is publicly available on the web. Anyone with a link to it can access it. Because snapshots do not require any authorization to view, Grafana removes information related to the account it came from, as well as any sensitive data from the snapshot.

## Share a dashboard

You can share a dashboard as a direct link or as a snapshot. You can also export a dashboard.

> **Note:** If you change a dashboard, ensure that you save the changes before sharing.

1. Navigate to the home page of your Grafana instance.
1. Click on the share icon in the top navigation.

   The share dialog opens and shows the **Link** tab.

   ![Dashboard share direct link](/static/img/docs/sharing/share-dashboard-direct-link-7-3.png)

### Share a direct link

The **Link** tab shows the current time range, template variables, and the default theme. You can also share a shortened URL.

1. Click **Copy**.

   This action copies the default or the shortened URL to the clipboard.

1. Send the copied URL to a Grafana user with authorization to view the link.

### Publish a snapshot

A dashboard snapshot shares an interactive dashboard publicly. Grafana strips sensitive data such as queries (metric, template and annotation) and panel links, leaving only the visible metric data and series names embedded in the dashboard. Dashboard snapshots can be accessed by anyone with the link.

You can publish snapshots to your local instance or to [snapshots.raintank.io](http://snapshots.raintank.io). The latter is a free service provided by Grafana Labs that enables you to publish dashboard snapshots to an external Grafana instance. Anyone with the link can view it. You can set an expiration time if you want the snapshot removed after a certain time period.

![Dashboard share snapshot](/static/img/docs/sharing/share-dashboard-snapshot-7-3.png)

1. Click **Local Snapshot** or **Publish to snapshots.raintank.io**.

   Grafana generates a link of the snapshot.

1. Copy the snapshot link, and share it either within your organization or publicly on the web.

If you created a snapshot by mistake, click **Delete snapshot** to remove the snapshot from your Grafana instance.

### Dashboard export

Grafana dashboards can easily be exported and imported. For more information, refer to [Export and import dashboards]({{< relref "../dashboards/export-import/" >}}).

![Export](/static/img/docs/sharing/share-dashboard-export-7-3.png)

## Export dashboard as PDF

You can generate and save PDF files of any dashboard.

> **Note:** Available in [Grafana Enterprise]({{< relref "../introduction/grafana-enterprise/" >}}).

1. In the upper-right corner of the dashboard that you want to export as PDF, click the **Share dashboard** icon.
1. On the PDF tab, select a layout option for the exported dashboard: **Portrait** or **Landscape**.
1. Click **Save as PDF** to render the dashboard as a PDF file.

   Grafana opens the PDF file in a new window or browser tab.

## Share a panel

You can share a panel as a direct link, as a snapshot, or as an embedded link. You can also create library panels using the **Share** option on any panel.

1. Click a panel title to open the panel menu.
1. Click **Share**.

   The share dialog opens and shows the **Link** tab.

   ![Panel share direct link](/static/img/docs/sharing/share-panel-direct-link-8-0.png)

### Use direct link

The **Link** tab shows the current time range, template variables, and the defaul theme. You can optionally enable a shortened URL to share.

1. Click **Copy**.

   This action copies the default or the shortened URL to the clipboard.

1. Send the copied URL to a Grafana user with authorization to view the link.
1. You also optionally click **Direct link rendered image** to share an image of the panel.

For more information, refer to [Image rendering]({{< relref "../setup-grafana/image-rendering/" >}}).

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

You can publish snapshots to your local instance or to [snapshots.raintank.io](http://snapshots.raintank.io). The latter is a free service provided by [Grafana Labs](https://grafana.com), that enables you to publish dashboard snapshots to an external Grafana instance. You can optionally set an expiration time if you want the snapshot to be removed after a certain time period.

![Panel share snapshot](/static/img/docs/sharing/share-panel-snapshot-8-0.png)

1. In the **Share Panel** dialog, click **Snapshot** to open the tab.
1. Click **Local Snapshot** or **Publish to snapshots.raintank.io**.

   Grafana generates the link of the snapshot.

1. Copy the snapshot link, and share it either within your organization or publicly on the web.

If you created a snapshot by mistake, click **Delete snapshot** to remove the snapshot from your Grafana instance.

### Embed panel

You can embed a panel using an iframe on another web site. A viewer must be signed into Grafana to view the graph.

**> Note:** As of Grafana 8.0, anonymous access permission is no longer available for Grafana Cloud.

![Panel share embed](/static/img/docs/sharing/share-panel-embedded-link-8-0.png)

Here is an example of the HTML code:

```html
<iframe
  src="https://snapshots.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4"
  width="650"
  height="300"
  frameborder="0"
></iframe>
```

The result is an interactive Grafana graph embedded in an iframe:

<iframe src="https://snapshots.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4" width="650" height="300" frameborder="0"></iframe>

### Library panel

To create a library panel from the **Share Panel** dialog:

1. Click **Library panel**.
   {{< figure src="/static/img/docs/library-panels/create-lib-panel-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the create library panel dialog" >}}
1. In **Library panel name**, enter the name.
1. In **Save in folder**, select the folder in which to save the library panel. By default, the General folder is selected.
1. Click **Create library panel** to save your changes.
1. Save the dashboard.

## Playlists

A _playlist_ is a list of dashboards that are displayed in a sequence. You might use a playlist to build situational awareness or to present your metrics to your team or visitors.

Grafana automatically scales dashboards to any resolution, which makes them perfect for big screens.

You can access the Playlist feature from Grafana's side menu, in the Dashboards submenu.

{{< figure src="/static/img/docs/v50/playlist.png" max-width="25rem">}}

### Create a playlist

You create a playlist to present dashboards in a sequence, with a set order and time interval between dashboards.

1. To access the Playlist feature, hover your cursor over Grafana's side menu.
1. Click **Playlists**.
1. Click **New playlist**.
1. In the **Name** field, enter a name for your playlist.
1. In the **Interval** text box, enter a time interval.

   The time interval is the amount of time for Grafana to show a particular dashboard before advancing to the next one on the playlist.

1. Next to the dashboard(s) you want to add to your playlist, click **Add to playlist**.
1. Click **Create**.

### Edit a playlist

You can edit playlists while creating them or after saving them.

1. To access the Playlist feature, hover your cursor over Grafana's side menu.
1. Click **Playlists**.
1. Click on the Playlist that you want to edit.

#### Edit the Name of a playlist

1. Double-click within the **Name** text box.
1. Enter a name.
1. Click **Save** to save your changes.

#### Edit the Interval of a playlist

1. Double-click within the **Interval** text box.
1. Enter a time interval.
1. Click **Save** to save your changes.

### Add a dashboard to a playlist

1. Next to the dashboard you want to add, click **Add to playlist**.
1. Click **Save** to save your changes.

### Search for a dashboard to add

1. Click the **Search dashboards by name** text box.
1. Search for the playlist by name or regular expression.
1. If needed, filter your results by starred status or tags.

   By default, your starred dashboards appear as options to add to the Playlist.

1. Click **Save** to save your changes.

### Rearrange dashboard order

1. Next to the dashboard you want to move, click the up or down arrow.
1. Click **Save** to save your changes.

### Remove a dashboard

1. Click **Remove[x]** to remove a dashboard from the playlist.
1. Click **Save** to save your changes.

### Delete a playlist

1. Click **Playlists**.
1. Next to the Playlist you want to delete, click **Remove[x]**.

### Save a playlist

You can save a playlist and add it to your **Playlists** page, where you can start it. Be sure that all the dashboards you want to appear in your playlist are added when creating or editing the playlist before saving it.

1. To access the Playlist feature, hover your cursor over Grafana's side menu.
1. Click **Playlists**.
1. Click on the playlist.
1. Edit the playlist.
1. Ensure that your playlist has a **Name**, **Interval**, and at least one **Dashboard** added to it.
1. Click **Save**.

### Start a playlist

You can start a playlist in five different view modes. View mode determine how the menus and navigation bar appear on the dashboards.

By default, each dashboard is displayed for the amount of time entered in the Interval field, which you set when you create or edit a playlist. After you start a playlist, you can control it with the navbar at the top of the page.

1. From the Dashboards submenu, click **Playlists**.
1. Next to the playlist you want to start, click **Start playlist**.
1. In the dropdown, select the mode in which you want the playlist to display.
   - **Normal mode:**
     - The side menu remains visible.
     - The navbar, row and panel controls appear at the top of the screen.
   - **TV mode:**
     - The side menu is hidden/removed.
     - The navbar, row, and panel controls appear at the top of the screen.
     - Enabled automatically after one minute of user inactivity.
     - You can enable it manually using the `d v` sequence shortcut, or by appending the parameter `?inactive` to the dashboard URL.
     - You can disable it with any mouse mouse movement or keyboard action.
   - **TV mode (with auto fit panels):**
     - The side menu is hidden/removed.
     - The navbar, row and panel controls appear at the top of the screen.
     - Dashboard panels automatically adjust to optimize space on screen.
   - **Kiosk mode:**
     - The side menu, navbar, row and panel controls are completely hidden/removed from view.
     - You can enable it manually using the `d v` sequence shortcut after the playlist has started.
     - You can disable it manually with the same shortcut.
   - **Kiosk mode (with auto fit panels):**
     - The side menu, navbar, row and panel controls are completely hidden/removed from view.
     - Dashboard panels automatically adjust to optimize space on screen.

### Control a playlist

You can control a playlist in **Normal** or **TV** mode after it's started, using the navigation bar at the top of your screen.

| Button                         | Result                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Next (double-right arrow)      | Advances to the next dashboard.                                                                                                                 |
| Back (left arrow)              | Returns to the previous dashboard.                                                                                                              |
| Stop (square)                  | Ends the playlist, and exits to the current dashboard.                                                                                          |
| Cycle view mode (monitor icon) | Rotates the display of the dashboards in different view modes.                                                                                  |
| Time range                     | Displays data within a time range. It can be set to display the last 5 minutes up to 5 years ago, or a custom time range, using the down arrow. |
| Refresh (circle arrow)         | Reloads the dashboard, to display the current data. It can be set to reload automatically every 5 seconds to 1 day, using the drop-down arrow.  |

> Shortcut: Press the `Esc` key to stop the playlist.

### Share a playlist in a view mode

You can share a playlist by copying the link address on the view mode you prefer, and pasting the URL to your destination.

1.  From the Dashboards submenu, click **Playlists**.
1.  Next to the playlist you want to share, click **Start playlist**.
1.  In the dropdown, right click the view mode you prefer.
1.  Click **Copy Link Address** to copy the URL to your clipboard.

    Example: The URL for the first playlist on the Grafana Play site in Kiosk mode will look like this:

    [https://play.grafana.org/playlists/play/1?kiosk](https://play.grafana.org/playlists/play/1?kiosk).

1.  Paste the URL to your destination.

## Reporting

Reporting enables you to automatically generate PDFs from any of your dashboards and have Grafana email them to interested parties on a schedule. This is available in Grafana Cloud Pro and Advanced and in Grafana Enterprise.

> If you have [Role-based access control]({{< relref "../administration/roles-and-permissions/access-control/" >}}) enabled, for some actions you would need to have relevant permissions.
> Refer to specific guides to understand what permissions are required.

{{< figure src="/static/img/docs/enterprise/reports_list_8.1.png" max-width="500px" class="docs-image--no-shadow" >}}

Any changes you make to a dashboard used in a report are reflected the next time the report is sent. For example, if you change the time range in the dashboard, then the time range in the report also changes.

### Requirements

- SMTP must be configured for reports to be sent. Refer to [SMTP]({{< relref "../setup-grafana/configure-grafana/#smtp" >}}) in [Configuration]({{< relref "../setup-grafana/configure-grafana/" >}}) for more information.
- The Image Renderer plugin must be installed or the remote rendering service must be set up. Refer to [Image rendering]({{< relref "../setup-grafana/image-rendering/" >}}) for more information.

### Access control

When [RBAC]({{< relref "../administration/roles-and-permissions/access-control/" >}}) is enabled, you need to have the relevant [Permissions]({{< relref "../administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/" >}}) to create and manage reports.

### Create or update a report

Only organization admins can create reports by default. You can customize who can create reports with [Role-based access control]({{< relref "../administration/roles-and-permissions/access-control/" >}}).

1. Click on the Reports icon in the side navigation menu.

   The Reports tab allows you to view, create, and update your reports. The report form has a multi-step layout. The steps do not need to be completed in succession and can be skipped over by clicking a step name.

1. Select report dashboard.
   - **Source dashboard:** Select the dashboard from which you want to generate the report.
   - **Time range:** (optional) Use custom time range for the report. For more information, refer to [Report time range]({{< relref "#report-time-range" >}}).
   - **Add another dashboard:** Add more than one dashboard to the report.
1. Format the report.
   - **Choose format options for the report:** Select at least one option. Attach report as PDF, embed dashboard as an image, or attach CSV file of table panel data.
   - If you selected the PDF format option:
     - Select an orientation for the report: **Portrait** or **Landscape**.
     - Select a layout for the generated report: **Simple** or **Grid**. The simple layout renders each panel as full-width across the PDF. The grid layout renders the PDF with the same panel arrangement and width as the source dashboard.
     - Click **Preview PDF** to view a rendered PDF with the options you selected.
1. Schedule report.
   - Enter scheduling information. Options vary depending on the frequency selected.
1. Enter report information. All fields are required unless otherwise indicated.
   - **Report name:** Name of the report as you want it to appear in the **Reports** list. The report name populates the email subject line.
   - **Recipients:** Enter the emails of the people or teams that you want to receive the report, separated by commas or semicolons.
   - **Reply to:** (optional) The address that appears in the **Reply to** field of the email.
   - **Message:** (optional) Message body in the email with the report.
   - **Include a dashboard link:** Include a link to the dashboard from within the report email.
   - **Send test email:** To verify that the configuration works as expected. You can choose to send this email to the recipients configured for the report, or to a different set of email addresses only used for testing.
1. Preview and save the report.

{{< figure src="/static/img/docs/enterprise/reports/select-dashboard.png" max-width="500px" class="docs-image--no-shadow" >}}
{{< figure src="/static/img/docs/enterprise/reports/format-report.png" max-width="500px" class="docs-image--no-shadow" >}}
{{< figure src="/static/img/docs/enterprise/reports/schedule.png" max-width="500px" class="docs-image--no-shadow" >}}
{{< figure src="/static/img/docs/enterprise/reports/share.png" max-width="500px" class="docs-image--no-shadow" >}}
{{< figure src="/static/img/docs/enterprise/reports/confirm.png" max-width="500px" class="docs-image--no-shadow" >}}

#### Choose template variables

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise/" >}}) version 7.5 and later behind the `reportVariables` feature flag, Grafana Enterprise version 8.0 and later without a feature flag, and [Grafana Cloud Pro and Advanced]({{< ref "/grafana-cloud" >}}).

You can configure report-specific template variables for the dashboard on the report page. The variables that you select will override the variables from the dashboard, and they are used when rendering a PDF file of the report. For detailed information about using template variables, refer to the [Templates and variables]({{< relref "../variables/" >}}) section.

> **Note:** The query variables saved with a report might become of date if the results of that query change. For example, if your template variable queries for a list of hostnames and a new hostname is added, then it will not be included in the report. If that occurs, the selected variables must be manually updated in the report. If you select the `All` value for the template variable or if you keep the dashboard's original variable selection, then the report stays up-to-date as new values are added.

#### Render a report with panels or rows set to repeat by a variable

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise/" >}}) version 8.0 and later, and [Grafana Cloud Pro and Advanced]({{< ref "/grafana-cloud" >}}).

You can include dynamic dashboards with panels or rows, set to repeat by a variable, into reports. For detailed information about setting up repeating panels or rows in dashboards, refer to [Repeat panels or rows]({{< relref "../panels/configure-panel-options/#configure-repeating-rows-or-panels" >}}).

##### Caveats

- Rendering repeating panels for dynamic variable types (for example, `query` variables) with selected `All` value is currently not supported. As a workaround, select all the values.
- If you select different template variables in a report for a dashboard with repeating rows, you might see empty space or missing values at the bottom of the report. This is because the dimensions of the panels from the dashboard are used to generate the report. To avoid this issue
  - use the dashboard's original template variables for the report, or make a copy of the dashboard
  - select the new set of template variables
  - generate a report based on the copied dashboard.
- Rendering of the repeating panels inside collapsed rows in reports is not supported.

#### Report time range

> **Note:** You can set custom report time ranges in [Grafana Enterprise]({{< relref "../enterprise/" >}}) 7.2+ and [Grafana Cloud Pro and Advanced]({{< ref "/grafana-cloud" >}}).

By default, reports use the saved time range of the dashboard. You can change the time range of the report by:

- Saving a modified time range to the dashboard.
- Setting a time range via the **Time range** field in the report form. If specified, the custom time range overrides the time range from the report's dashboard.

The page header of the report displays the time range for the dashboard's data queries. Dashboards set to use the browser's time zone use the time zone on the Grafana server.

If the time zone is set differently between your Grafana server and its remote image renderer, then the time ranges in the report might be different between the page header and the time axes in the panels. To avoid this, set the time zone to UTC for dashboards when using a remote renderer. Each dashboard's time zone setting is visible in the [time range controls]({{< relref "../dashboards/time-range-controls/#dashboard-time-settings" >}}).

#### Layout and orientation

> We're actively developing new report layout options. [Contact us](https://grafana.com/contact?about=grafana-enterprise&topic=design-process&value=reporting) to get involved in the design process.

| Layout | Orientation | Support | Description                                                                                               | Preview                                                                                                                                               |
| ------ | ----------- | ------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simple | Portrait    | v6.4+   | Generates an A4 page in portrait mode with three panels per page.                                         | {{< figure src="/static/img/docs/enterprise/reports_portrait_preview.png" max-width="500px" max-height="500px" class="docs-image--no-shadow" >}}      |
| Simple | Landscape   | v6.7+   | Generates an A4 page in landscape mode with a single panel per page.                                      | {{< figure src="/static/img/docs/enterprise/reports_landscape_preview.png" max-width="500px" class="docs-image--no-shadow" >}}                        |
| Grid   | Portrait    | v7.2+   | Generates an A4 page in portrait mode with panels arranged in the same way as at the original dashboard.  | {{< figure src="/static/img/docs/enterprise/reports_grid_portrait_preview.png" max-width="500px" max-height="500px" class="docs-image--no-shadow" >}} |
| Grid   | Landscape   | v7.2+   | Generates an A4 page in landscape mode with panels arranged in the same way as in the original dashboard. | {{< figure src="/static/img/docs/enterprise/reports_grid_landscape_preview.png" max-width="500px" class="docs-image--no-shadow" >}}                   |

#### CSV export

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise/" >}}) 8+ with the [Grafana image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) v3.0+, and [Grafana Cloud Pro and Advanced]({{< ref "/grafana-cloud" >}}).

You can attach a CSV file to the report email for each table panel on the selected dashboard, along with the PDF report. By default, CSVs larger than 10Mb are not sent which keeps email servers from rejecting the email. You can increase or decrease this limit in the [reporting configuration]({{< relref "#rendering-configuration" >}}).

This feature relies on the same plugin that supports the [image rendering]({{< relref "../setup-grafana/image-rendering/" >}}) features.

When the CSV file is generated, it is temporarily written to the `csv` folder in the Grafana `data` folder.

A background job runs every 10 minutes and removes temporary CSV files. You can configure how long a CSV file should be stored before being removed by configuring the [temp-data-lifetime]({{< relref "../setup-grafana/configure-grafana/#temp-data-lifetime" >}}) setting. This setting also affects how long a renderer PNG file should be stored.

#### Scheduling

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise/" >}}) version 8.0 and later, and [Grafana Cloud Pro and Advanced]({{< ref "/grafana-cloud" >}}).
> The scheduler was significantly changed in Grafana Enterprise version 8.1.

Scheduled reports can be sent once, or repeated on an hourly, daily, weekly, or monthly basis, or sent at custom intervals. You can also disable scheduling by selecting **Never**, for example to send the report via the API.

{{< figure src="/static/img/docs/enterprise/reports_scheduler_8.1.png" max-width="500px" class="docs-image--no-shadow" >}}

**Send now or schedule for later**

- **Send now** sends the report immediately after you save it. To stop sending the report at some point in the future, add an end date. If you leave the end date empty, the report is sent out indefinitely.

- **Send later** schedules a report for a later date. Thus, the start date and time are required fields. If you leave the end date empty, the report is sent out indefinitely.

**Send only from Monday to Friday**

For reports that have an hourly or daily frequency, you can choose to send them only from Monday to Friday.

**Send on the last day of the month**

When you schedule a report with a monthly frequency, and set the start date between the 29th and the 31st of the month, the report is only sent during the months that have those dates. If you want the report to be sent every month, select the **Send on the last day of the month** option instead. This way, the report is sent on the last day of every month regardless of how many days there are in any given month.

#### Send a test email

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise/" >}}) version 7.0 and later, and [Grafana Cloud Pro and Advanced]({{< ref "/grafana-cloud" >}}).

1. In the report, click **Send test email**.
1. In the **Email** field, enter the email address or addresses that you want to test, separated by a semicolon.
   If you want to use email addresses from the report, then select the **Use emails from report** check box.
1. Click **Send**.

The last saved version of the report will be sent to selected emails. You can use this to verify emails are working and to make sure the report is generated and displayed as you expect.

{{< figure src="/static/img/docs/enterprise/reports_send_test_mail.png" max-width="500px" class="docs-image--no-shadow" >}}

#### Pause a report

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise/" >}}) version 8.0 and later, and [Grafana Cloud Pro and Advanced]({{< ref "/grafana-cloud" >}}).

You can pause sending reports from the report list view by clicking the pause icon. The report will not be sent according to its schedule until it is resumed by clicking the resume button on the report row.

#### Add multiple dashboards to a report

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise/" >}}) version 9.0 and later, and [Grafana Cloud Pro and Advanced]({{< relref "/grafana-cloud" >}}).

You can add more than one dashboard to a report. Additional dashboards will be rendered as new pages in the same PDF file, or additional images if you chose to embed images in your report email. You cannot add the same dashboard to a report multiple times.

#### Embed a dashboard as an image into a report

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise/" >}}) version 9.0 and later, and [Grafana Cloud Pro and Advanced]({{< relref "/grafana-cloud" >}}).

You can send a report email with an image of the dashboard embedded in the email instead of attached as a PDF. In this case, the email recipients can see the dashboard at a glance instead of having to open the PDF.

### Send a report via the API

You can send reports programmatically with the [send report]({{< relref "../developers/http_api/reporting/#send-report" >}}) endpoint in the [HTTP APIs]({{< relref "../developers/http_api/" >}}).

### Rendering configuration

When generating reports, each panel renders separately before being collected in a PDF. You can configure the per-panel rendering timeout and number of concurrently rendered panels.

To make a panel more legible, you can set a scale factor for the rendered images. However, a higher scale factor increases the file size of the generated PDF.

You can also specify custom fonts that support different Unicode scripts. The DejaVu font is the default used for PDF rendering.

These options are available in the [configuration]({{< relref "../setup-grafana/configure-grafana/" >}}) file.

```ini
[reporting]
# Use this option to enable or disable the reporting feature. When disabled, no reports are generated, and the UI is hidden. By default, reporting is enabled.
enabled = true
# Set timeout for each panel rendering request
rendering_timeout = 10s
# Set maximum number of concurrent calls to the rendering service
concurrent_render_limit = 4
# Set the scale factor for rendering images. 2 is enough for monitor resolutions
# 4 would be better for printed material. Setting a higher value affects performance and memory
image_scale_factor = 2
# Set the maximum file size in megabytes for the CSV attachments
max_attachment_size_mb = 10
# Path to the directory containing font files
fonts_path =
# Name of the TrueType font file with regular style
font_regular = DejaVuSansCondensed.ttf
# Name of the TrueType font file with bold style
font_bold = DejaVuSansCondensed-Bold.ttf
# Name of the TrueType font file with italic style
font_italic = DejaVuSansCondensed-Oblique.ttf
```

### Report settings

> **Note:** Available in [Grafana Enterprise]({{< relref "../enterprise/" >}}) version 7.2 and later, and [Grafana Cloud Pro and Advanced]({{< ref "/grafana-cloud" >}}).

You can configure organization-wide report settings in the **Settings** tab on the **Reporting** page. Settings are applied to all the reports for current organization.

You can customize the branding options.

Report branding:

- **Company logo URL:** Company logo displayed in the report PDF. Defaults to the Grafana logo.

Email branding:

- **Company logo URL:** Company logo displayed in the report PDF. Defaults to the Grafana logo.
- **Email footer:** Toggle to enable the report email footer. Select **Sent by** or **None**.
- **Footer link text:** Text of the link in the report email footer. Defaults to `Grafana`.
- **Footer link URL:** Link of the report email footer.

{{< figure src="/static/img/docs/enterprise/reports_settings.png" max-width="500px" class="docs-image--no-shadow" >}}

### Troubleshoot reporting

To troubleshoot and get more log information, enable debug logging in the configuration file. Refer to [Configuration]({{< relref "../setup-grafana/configure-grafana/#filters" >}}) for more information.

```bash
[log]
filters = report:debug
```
