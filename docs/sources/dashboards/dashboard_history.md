+++
title = "Dashboard Version History"
keywords = ["grafana", "dashboard", "documentation", "version", "history"]
type = "docs"
aliases = ["/docs/grafana/latest/reference/dashboard_history/"]
[menu.docs]
name = "Dashboard Version History"
parent = "dashboard_features"
weight = 100
+++


# Dashboard Version History

Whenever you save a version of your dashboard, a copy of that version is saved so that previous versions of your dashboard are never lost. A list of these versions is available by entering the dashboard settings and then selecting "Versions" in the left side menu.

<img class="no-shadow" src="/img/docs/v50/dashboard_versions_list.png">

The dashboard version history feature lets you compare and restore to previously saved dashboard versions.

## Comparing two dashboard versions

To compare two dashboard versions, select the two versions from the list that you wish to compare. Once selected, the "Compare versions" button will become clickable. Click the button to view the diff between the two versions.

<img class="no-shadow" src="/img/docs/v50/dashboard_versions_select.png">

Upon clicking the button, you'll be brought to the diff view. By default, you'll see a textual summary of the changes, like in the image below.

<img class="no-shadow" src="/img/docs/v50/dashboard_versions_diff_basic.png">

If you want to view the diff of the raw JSON that represents your dashboard, you can do that as well by clicking the "View JSON Diff" button at the bottom.

If you want to restore to the version you are diffing against, you can do so by clicking the "Restore to version \<x\>" button in the top right.

## Restoring to a previously saved dashboard version

If you need to restore to a previously saved dashboard version, you can do so by either clicking the "Restore" button on the right of a row in the dashboard version list, or by clicking the "Restore to version \<x\>" button appearing in the diff view. Clicking the button will bring up the following popup prompting you to confirm the restoration.

<img class="no-shadow" src="/img/docs/v50/dashboard_versions_restore.png">

After restoring to a previous version, a new version will be created containing the same exact data as the previous version, only with a different version number. This is indicated in the "Notes column" for the row in the new dashboard version. This is done simply to ensure your previous dashboard versions are not affected by the change.
