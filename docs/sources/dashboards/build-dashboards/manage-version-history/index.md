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
labels:
  products:
    - cloud
    - enterprise
    - oss
menutitle: Manage version history
title: Manage dashboard version history
description: View and compare previous versions of your dashboard
weight: 400
---

# Manage dashboard version history

Whenever you save a version of your dashboard, a copy of that version is saved so that previous versions of your dashboard are never lost. You can see a list of dashboard versions in the **Versions** tab of the dashboard settings:

![Dashboards versions list](/media/docs/grafana/dashboards/screenshot-dashboard-version-list-11.2.png)

The dashboard version history feature lets you compare and restore to previously saved dashboard versions.

## Compare two dashboard versions

To compare two dashboard versions, follow these steps:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click **Settings**.
1. Go to the **Versions** tab.
1. Select the two dashboard versions that you want to compare.
1. Click **Compare versions** to view the diff between the two versions.
1. Review the text descriptions of the differences between the versions.
1. (Optional) Expand the **View JSON Diff** section of the page to see the diff of the raw JSON that represents your dashboard.
1. When you've finished comparing versions, click **Back to dashboard** and **Exit edit**.

When you're comparing versions, if one of the versions you've selected is the latest version, a button to restore the previous version is also displayed, so you can restore a version from the compare view:

![Dashboards versions diff](/media/docs/grafana/dashboards/screenshot-dashboard-compare-versions-restore-11.2.png)

## Restore a previously dashboard version

To restore to a previously saved dashboard version, follow these steps:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click **Settings**.
1. Go to the **Versions** tab.
1. Click the **Restore** button next to the version.

When you restore a version, the dashboard is immediately saved and you're no longer in edit mode.

After you restore a previous version, a new version of the dashboard is created containing the same exact data as the previous version, but with a different version number. This is indicated in the **Notes column** in the **Versions** tab of the dashboard settings. This is done simply to ensure your previous dashboard versions are not affected by the change.
