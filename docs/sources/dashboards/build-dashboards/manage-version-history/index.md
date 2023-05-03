---
aliases:
  - ../../reference/dashboard_history/
  - ../dashboard-history/
keywords:
  - grafana
  - dashboard
  - documentation
  - version
  - history
menutitle: Manage version history
title: Manage dashboard version history
weight: 400
---

# Manage dashboard version history

Whenever you save a version of your dashboard, a copy of that version is saved so that previous versions of your dashboard are never lost. A list of these versions is available by entering the dashboard settings and then selecting "Versions" in the left side menu.

![Dashboards versions list](/media/docs/grafana/dashboards/screenshot-dashboard-versions-list.png)

The dashboard version history feature lets you compare and restore to previously saved dashboard versions.

## Comparing two dashboard versions

To compare two dashboard versions, select the two versions from the list that you wish to compare. Once selected, the "Compare versions" button will become clickable. Click the button to view the diff between the two versions.

![Dashboard versions selected](/media/docs/grafana/dashboards/screenshot-dashboard-versions-select.png)

Upon clicking the button, you'll be brought to the diff view. By default, you'll see a textual summary of the changes, like in the image below.

![Dashboards versions diff](/media/docs/grafana/dashboards/screenshot-dashboard-versions-diff-basic.png)

If you want to view the diff of the raw JSON that represents your dashboard, you can do that as well by clicking the expand icon for the View JSON Diff section at the bottom.

## Restoring to a previously saved dashboard version

If you need to restore to a previously saved dashboard version, you can do so by either clicking the "Restore" button on the right of a row in the dashboard version list, or by clicking the **Restore to version \<x\>** button appearing in the diff view. Clicking the button will bring up the following popup prompting you to confirm the restoration.

![Restore dashboard version](/media/docs/grafana/dashboards/screenshot-dashboard-versions-restore.png)

After restoring to a previous version, a new version will be created containing the same exact data as the previous version, only with a different version number. This is indicated in the "Notes column" for the row in the new dashboard version. This is done simply to ensure your previous dashboard versions are not affected by the change.
