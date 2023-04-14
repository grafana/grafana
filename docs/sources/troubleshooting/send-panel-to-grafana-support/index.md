---
description: Learn how to send a panel to Grafana Labs support for troubleshooting
keywords:
  - grafana
  - troubleshooting
  - support
  - dashboards
title: Send a panel to Grafana Labs support
menutitle: Send panel to support
weight: 100
---

# Send a panel to Grafana Labs support

When you encounter problems with any of your visualizations, you can send the panel JSON model to Grafana Labs Technical Support and request help with troubleshooting your issue.

The panel that you send includes all query response data and all visualizations settings. Upon receiving your panel, Grafana Labs Technical Support imports your data into a local version of Grafana and begins researching your problem.

1. Open the dashboard that contains the panel you want to send to Grafana Labs.

1. Hover over any part of the panel to display the actions menu on the top right corner.

1. Click the menu and select **More > Get help**.

   Grafana opens a standalone support dashboard that contains the data you are sending to Grafana Labs Technical Support.

   If you enable iframes, the support dashboard includes the visualization that looks similar to the following image.

   ![Support panel](/static/img/docs/troubleshooting/grafana-support-panel.png)

1. To send the panel data to Grafana Labs via Github:

   a. Click **Copy to clipboard**.

   b. In the [Grafana/Grafana](https://github.com/grafana/grafana) repository, create an issue, and paste the contents of the support dashboard.

1. To send the panel data to Grafana Labs via a support ticket:

   a. Click **Dashboard**.

   Grafana downloads the support dashboard to a TXT file.

   b. Attach the TXT file to a support ticket that you send to Grafana Labs Technical Support.
