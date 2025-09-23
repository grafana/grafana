---
aliases:
  - ../reference/playlist/
  - playlist/
keywords:
  - grafana
  - dashboard
  - documentation
  - playlist
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Manage playlists
title: Manage playlists
description: Create and manage dashboard playlists
weight: 500
---

# Manage playlists

A _playlist_ is a list of dashboards that are displayed in a sequence. You might use a playlist to build situational awareness or to present your metrics to your team or visitors.

Grafana automatically scales dashboards to any resolution, which makes them perfect for big screens.

You can access the **Playlist** feature from Grafana's side menu, in the Dashboards submenu.

{{< admonition type="note" >}}
You must have at least Editor role permissions to create and manage playlists.
{{< /admonition >}}

## Access, share, and control a playlist

Use the information in this section to access playlists. Start and control the display of a playlist using one of the six available modes.

### Access a playlist

1. Click **Dashboards** in the main menu.
1. Click **Playlists** to see a list of playlists.

### Start a playlist

You can start a playlist in four different view modes. View modes determine how the menus and navigation bar appear on the dashboards as well as how panels are sized.

1. Click **Dashboards** in the main menu.
1. Click **Playlists**.
1. Find the desired playlist and click **Start playlist**.
1. In the dialog box that opens, select one of the [four playlist modes](#playlist-modes) available.
1. Disable any dashboard controls that you don't want displayed while the list plays; these controls are enabled and visible by default. Select from:

   - **Time and refresh**
   - **Variables**
   - **Dashboard links**

1. Click **Start \<playlist name\>**.

The playlist displays each dashboard for the time specified in the **Interval** field, set when creating or editing a playlist. After a playlist starts, you can [start or stop it](#control-a-playlist) it using the controls at the top of your screen.

### Playlist modes

<!-- prettier-ignore-start -->

| Mode                               | Description                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Normal mode                        | <ul><li>The main menu and navbar remain visible.</li><li>Dashboard controls are hidden.</li><li>Playlist controls are displayed at the top of the screen.<li><ul> |
| Normal mode (with auto fit panels) | <ul><li>The main menu and navbar remain visible.</li><li>Dashboard controls are hidden.</li><li>Playlist controls are displayed at the top of the screen.</li><li>Dashboard panels automatically adjust to optimize space on screen.</li></ul> |
| Kiosk mode                         | <ul><li>The main menu, navbar, and dashboard controls are hidden.</li><li>You can disable the playlist manually by pressing the `Esc` key after the playlist has started. Doing so causes the playlist controls to be displayed at the top of the screen briefly.</li></ul> |
| Kiosk mode (with auto fit panels)  | <ul><<li>The main menu, navbar, and dashboard controls are hidden.</li><li>You can disable the playlist manually by pressing the `Esc` key after the playlist has started. Doing so causes the playlist controls to be displayed at the top of the screen briefly.</li><li>Dashboard panels automatically adjust to optimize space on screen.</li></ul> |

<!-- prettier-ignore-end -->

### Playlist controls

You can control a playlist in **Normal** mode after it's started, using the buttons at the top of your screen. Press the `Esc` key to stop the playlist.

- **Next (double-right arrow)** - Advances to the next dashboard.
- **Back (doublt-left arrow)** - Returns to the previous dashboard.
- **Stop playlist** - Ends the playlist, and exits to the current dashboard.

## Create a playlist

You can create a playlist to present dashboards in a sequence, with a set order and time interval between dashboards. Be sure that all the dashboards you want to appear in your playlist are added before you create the playlist.

1. Click **Dashboards** in the main menu.
1. Click **Playlists**.
1. Click **New playlist**.
1. In the **Name** field, enter a descriptive name.
1. In the **Interval** field, enter the time interval each dashboard is displayed before moving on to the next dashboard.
1. In the **Add dashboards** section, add dashboards to the playlist using the **Add by title** and **Add by tag** drop-down options.

   Added dashboards are displayed in a list in the **Dashboards** section of the page, in the order you added them. This is also the play order of the dashboards.

1. Click **Save**.

## Edit a playlist

You can edit a playlist including adding, removing, and rearranging the order of dashboards.

1. Click **Dashboards** in the main menu.
1. Click **Playlists**.
1. Find the playlist you want to update and click **Edit playlist**. Do one or more of the following:

   - Edit - Update the name and time interval.
   - Add dashboards - Search for dashboards by title or tag to add them to the playlist.
   - Rearrange dashboards - Click and drag the dashboards into your desired order.
   - Remove dashboards - Click the **X** next to the name of the dashboard you want to remove from the playlist.

1. Click **Save**.

## Share a playlist in a view mode

You can share a playlist by copying the link address on the view mode you prefer, and pasting the URL to your destination.

1. Click **Dashboards** in the main menu.
1. Click **Playlists**.
1. Click the share icon of the playlist you want to share.
1. Select the view mode you prefer.
1. Click **Copy** next to the **Link URL** to copy it to your clipboard.
1. Paste the URL to your destination.

## Delete a playlist

When you no longer need a playlist, follow these steps to delete it:

1. Click **Dashboards** in the main menu.
1. Click **Playlists**.
1. Find the playlist you want to remove.
1. Click **Delete playlist**.
