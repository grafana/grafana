---
aliases:
  - /docs/grafana/latest/dashboards/playlist/
  - /docs/grafana/latest/reference/playlist/
keywords:
  - grafana
  - dashboard
  - documentation
  - playlist
title: Manage playlists
menuTitle: Manage playlists
weight: 9
---

# Manage playlists

A _playlist_ is a list of dashboards that are displayed in a sequence. You might use a playlist to build situational awareness or to present your metrics to your team or visitors.

Grafana automatically scales dashboards to any resolution, which makes them perfect for big screens.

You can access the Playlist feature from Grafana's side menu, in the Dashboards submenu.

{{< figure src="/static/img/docs/v50/playlist.png" max-width="25rem">}}

## Access, share, and control a playlist

Use the information in this section to access existing playlists. Start and control the display of a playlist using one of the five available modes.

### Access a playlist

1. Hover your cursor over Grafana’s side menu.
1. Click **Playlists**. You will see a list of existing playlists.

### Start a playlist

You can start a playlist in five different view modes. View mode determine how the menus and navigation bar appear on the dashboards.

By default, each dashboard is displayed for the amount of time entered in the Interval field, which you set when you create or edit a playlist. After you start a playlist, you can control it with the navbar at the top of the page.

1. [Access](#access-playlist) the playlist page to see a list of existing playlists.
1. Find the playlist you want to start, then click **Start playlist**. The start playlist dialog opens.
1. Select one of the five playlist modes available based on the information in the following table.
1. Click **Start <playlist name>**.

The playlist displays each dashboard for the time specified in the `Interval` field, set when creating or editing a playlist. Once a playlist starts, you can [control](#control-a-playlist) it using the navbar at the top of your screen.

| Mode                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal mode                       | <ul><li>The side menu remains visible.</li></ul><ul><li>The navbar, row, and panel controls appear at the top of the screen.</li></ul>                                                                                                                                                                                                                                                                                                                                                                            |
| TV mode                           | <ul><li>The side menu and dashboard submenu (including variable drop-downs and dashboard links) are hidden or removed.</li></ul><ul><li>The navbar, row, and panel controls appear at the top of the screen.</li></ul><ul><li>Enabled automatically after one minute of user inactivity.</li></ul><ul><li>Enable it manually using the `d v` sequence shortcut, or by appending the parameter `?inactive` to the dashboard URL.</li></ul><ul><li>Disable it with any mouse movement or keyboard action.</li></ul> |
| TV mode (with auto fit panels)    | <ul><li>The side menu and dashboard submenu (including variable drop-downs and dashboard links) are hidden or removed.</li></ul><ul><li>The navbar, row and panel controls appear at the top of the screen.</li></ul><ul><li>Dashboard panels automatically adjust to optimize space on screen.</li></ul><ul>                                                                                                                                                                                                     |
| Kiosk mode                        | <ul><li>The side menu, navbar, ro and panel controls are completely hidden/removed from view.</li></ul><ul><li>You can enable it manually using the `d v` sequence shortcut after the playlist has started.</li></ul><ul><li>You can disable it manually with the same shortcut.</li></ul>                                                                                                                                                                                                                        |
| Kiosk mode (with auto fit panels) | <ul><li>The side menu, navbar, row, and panel controls are completely hidden/removed from view.</li></ul><ul><li>Dashboard panels automatically adjust to optimize space on screen.</li></ul>                                                                                                                                                                                                                                                                                                                     |

### Control a playlist

You can control a playlist in **Normal** or **TV** mode after it's started, using the navigation bar at the top of your screen. Press the Esc key in your keyboard to stop the playlist.

| Button                         | Result                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Next (double-right arrow)      | Advances to the next dashboard.                                                                                                                 |
| Back (left arrow)              | Returns to the previous dashboard.                                                                                                              |
| Stop (square)                  | Ends the playlist, and exits to the current dashboard.                                                                                          |
| Cycle view mode (monitor icon) | Rotates the display of the dashboards in different view modes.                                                                                  |
| Time range                     | Displays data within a time range. It can be set to display the last 5 minutes up to 5 years ago, or a custom time range, using the down arrow. |
| Refresh (circle arrow)         | Reloads the dashboard, to display the current data. It can be set to reload automatically every 5 seconds to 1 day, using the drop-down arrow.  |

## Create a playlist

You can create a playlist to present dashboards in a sequence, with a set order and time interval between dashboards.

1. In the playlist page, click **New playlist**. The New playlist page opens.
1. In the **Name** text box, enter a descriptive name.
1. In the **Interval** text box, enter a time interval. Grafana displays a particular dashboard for the interval of time specified here before moving on to the next dashboard.
1. In Dashboards, add existing dashboards to the playlist using **Add by title** and **Add by tag** drop-down options. The dashboards you add are listed in a sequential order.
1. If needed:
   - Search for a dashboard by its name, a regular expression, or a tag.
   - Filter your results by starred status or tags.
1. If needed, rearrange the order of the dashboard you have added using the up and down arrow icon.
1. Optionally, remove a dashboard from the playlist by clicking the x icon beside dashboard.
1. Click **Save**.

{{< figure src="/static/img/docs/dashboards/create-playlist-8-2.png" max-width="25rem">}}

## Save a playlist

You can save a playlist and add it to your **Playlists** page, where you can start it. Be sure that all the dashboards you want to appear in your playlist are added when creating or editing the playlist before saving it.

1. To access the Playlist feature, hover your cursor over Grafana's side menu.
1. Click **Playlists**.
1. Click on the playlist.
1. Edit the playlist.
1. Ensure that your playlist has a **Name**, **Interval**, and at least one **Dashboard** added to it.
1. Click **Save**.

## Edit or delete a playlist

You can edit a playlist by updating its name, interval time, and by adding, removing, and rearranging the order of dashboards. On the rare occasion when you no longer need a playlist, you can delete it.

### Edit a playlist

1. In the playlist page, click **Edit playlist**. The Edit playlist page opens.
1. Update the name and time interval, then add or remove dashboards from the playlist using instructions in [Create a playlist](#create-a-playlist).
1. Click **Save** to save your changes.

### Delete a playlist

1. Click **Playlists**.
1. Next to the Playlist you want to delete, click **Remove[x]**.

### Rearrange dashboard order

1. Next to the dashboard you want to move, click the up or down arrow.
1. Click **Save** to save your changes.

### Remove a dashboard

1. Click **Remove[x]** to remove a dashboard from the playlist.
1. Click **Save** to save your changes.

## Share a playlist in a view mode

You can share a playlist by copying the link address on the view mode you prefer, and pasting the URL to your destination.

1.  From the Dashboards submenu, click **Playlists**.
1.  Next to the playlist you want to share, click **Start playlist**.
1.  In the dropdown, right click the view mode you prefer.
1.  Click **Copy Link Address** to copy the URL to your clipboard.

        Example: The URL for the first playlist on the Grafana Play site in Kiosk mode will look like this:

    [https://play.grafana.org/playlists/play/1?kiosk](https://play.grafana.org/playlists/play/1?kiosk).

1.  Paste the URL to your destination.
