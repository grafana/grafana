---
aliases:
  - /docs/grafana/latest/troubleshooting/send-panel-to-grafana-support/
description: Learn how to send a panel to Grafana support for troubleshooting
keywords:
  - grafana
  - troubleshooting
  - support
  - dashboards
title: Send a panel to Grafana support
menutitle: Send panel to support
weight: 100
---

# Send a panel to Grafana support

When you encounter problems with any of your visualizations, you can send the panel JSON model to Grafana Labs Technical Support and request help with troubleshooting your issue.

The panel that you send includes all query response data and all visualizations settings. Upon receiving your panel, Grafana Labs Technical Support imports your data into a local version of Grafana and begins researching your problem.

**Before you begin:**

- Does the user completing this task require any permissions?
- xxx
- xxx

**To send a panel to Grafana support:**

1. Open the dashboard that contains the panel you want to send to Grafana Labs.

1. Hover your mouse cursor over the panel title and click **Inspect > Support snapshot**

   Grafana opens a standalone support dashboard that contains the data you are sending to Grafana Labs Technical Support.

1. Perform one of the following actions to send the panel data to Grafana Labs Technical Support:

- Create an issue in the Grafana repository:

  a. Click **Copy for Github**.

  b. In the [Grafana/Grafana](https://github.com/grafana/grafana) repository, create an issue and paste the contents of the support dashboard.

- Email Grafana Labs Technical Support a copy of the data:

  a. Click **Dashboard**.

  Grafana downlads the support dashboard to a TXT file.

  b. Attach the TXT file to a support ticket that you send to [Grafana Labs Technical Support](LINK?).
