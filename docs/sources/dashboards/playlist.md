+++
title = "Playlist"
keywords = ["grafana", "dashboard", "documentation", "playlist"]
aliases = ["/docs/grafana/latest/reference/playlist/"]
weight = 4
+++

# Playlist

A playlist displays a list of dashboards that are in a sequence. Use a playlist to build situational awareness or to present your metrics to your team or visitors. Grafana automatically scales dashboards to any resolution, which makes them perfect for big screens. This topic has the following sections:

## Access playlist

1. Hover your cursor over Grafana’s side menu.
1. Click **Playlists**. You will see a list of existing playlists.

## Start a playlist

1. Hover your cursor over Grafana’s side menu, the click **Playlists**. You will see a list of existing playlists.
1. Select your playlist mode based on the information in the following table.

| Mode                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal mode                       | <ul><li>The side menu remains visible.</li></ul><ul><li>The navbar, row and panel controls appear at the top of the screen.</li></ul>                                                                                                                                                                                                                                                                                                 |
| TV mode                           | <ul><li>The side menu is hidden or removed.</li></ul><ul><li>The navbar, row and panel controls appear at the top of the screen.</li></ul><ul><li>Enabled automatically after one minute of user inactivity.</li></ul><ul><li>Enable it manually using the `d v` sequence shortcut, or by appending the parameter `?inactive` to the dashboard URL.</li></ul><ul><li>Disable it with any mouse movement or keyboard action.</li></ul> |
| TV mode (with auto fit panels)    | <ul><li>The side menu is hidden or removed.</li></ul><ul><li>The navbar, row and panel controls appear at the top of the screen.</li></ul><ul><li>Dashboard panels automatically adjust to optimize space on screen.</li></ul><ul>                                                                                                                                                                                                    |
| Kiosk mode                        | <ul><li>The side menu, navbar, row and panel controls are completely hidden/removed from view.</li></ul><ul><li>You can enable it manually using the `d v` sequence shortcut after the playlist has started.</li></ul><ul><li>You can disable it manually with the same shortcut.</li></ul>                                                                                                                                           |
| Kiosk mode (with auto fit panels) | <ul><li>The side menu, navbar, row and panel controls are completely hidden/removed from view.</li></ul><ul><li>Dashboard panels automatically adjust to optimize space on screen.</li></ul>                                                                                                                                                                                                                                          |

By default, each dashboard displays for the amount of time entered in the Interval field, which can be set while creating or editing a playlist. Once a playlist is started, you can [control it](#control-a-playlist) using the navbar at the top of your screen.

## Control a playlist

You can control a playlist in **Normal** or **TV** mode after it's started, using the navigation bar at the top of your screen. Press the Esc key in your keyboard to stop the playlist.

| Button                         | Result                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Next (double-right arrow)      | Advances to the next dashboard.                                                                                                                 |
| Back (left arrow)              | Returns to the previous dashboard.                                                                                                              |
| Stop (square)                  | Ends the playlist, and exits to the current dashboard.                                                                                          |
| Cycle view mode (monitor icon) | Rotates the display of the dashboards in different view modes.                                                                                  |
| Time range                     | Displays data within a time range. It can be set to display the last 5 minutes up to 5 years ago, or a custom time range, using the down arrow. |
| Refresh (circle arrow)         | Reloads the dashboard, to display the current data. It can be set to reload automatically every 5 seconds to 1 day, using the drop down arrow.  |

## Create a playlist

You can create a playlist to present dashboards in a sequence, with a set order and time interval between dashboards.

1. In the playlist page, click **New playlist**.
1. In the **Name** text box, enter a name for your playlist.
1. In the **Interval** text box, enter a time interval.

The time interval is the amount of time for Grafana to stay on a particular dashboard before advancing to the next one on the playlist.

1. Next to the dashboard(s) you want to add to your playlist, click **Add to playlist**.
1. Click **Create**.

## Edit a playlist

You can edit playlists while creating them or after saving them.

1. To access the Playlist feature, hover your cursor over Grafana's side menu.
1. Click **Playlists**.
1. Click on the Playlist that you want to edit.

### Edit the Name of a playlist

1. Double-click within the **Name** text box.
1. Enter a name.
1. Click **Save** to save your changes.

{{< figure src="/static/img/docs/v50/playlist.png" max-width="25rem">}}

### Edit the Interval of a playlist

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
   By default, your starred dashboards will appear as options to add to the Playlist.
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

## Save a playlist

You can save a playlist to add it to your **Playlists** page, where you can start it. Be sure that all the dashboards you want to appear in your playlist are added when creating or editing the playlist before saving it.

1. To access the Playlist feature, hover your cursor over Grafana's side menu.
1. Click **Playlists**.
1. Click on the playlist.
1. Edit the playlist.
   - Ensure that your playlist has a **Name**, **Interval**, and at least one **Dashboard** added to it.
1. Click **Save**.

## Share a playlist in a view mode

You can share a playlist by copying the link address on the view mode you prefer, and pasting the URL to your destination.

1.  From the Dashboards submenu, click **Playlists**.
1.  Next to the playlist you want to share, click **Start playlist**.
1.  In the dropdown, right click the view mode you prefer.
1.  Click **Copy Link Address** to copy the URL to your clipboard.

        Example: The URL for the first playlist on the Grafana Play site in Kiosk mode will look like this:

    [https://play.grafana.org/playlists/play/1?kiosk](https://play.grafana.org/playlists/play/1?kiosk).

1.  Paste the URL to your destination.
