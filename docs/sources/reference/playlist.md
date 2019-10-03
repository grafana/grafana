+++
title = "Playlist"
keywords = ["grafana", "dashboard", "documentation", "playlist"]
type = "docs"
[menu.docs]
parent = "dashboard_features"
identifier = "feature_playlist"
weight = 4
+++


# Playlist

The Playlist is a special type of Dashboard that rotates through a list of Dashboards. A Playlist can be a great way to build situational awareness, and show off your metrics to your team or visitors.

Grafana automatically scales Dashboards to any resolution, which makes them perfect for big screens.

Access the Playlist feature from Grafana's side menu, in the Dashboard submenu.

## Create a playlist

{{< docs-imagebox img="/img/docs/v50/playlist.png" max-width="25rem" class="docs-image--right">}}

To create a playlist: 

1. Click the __New playlist__ button.
2. Name your playlist in the __Name__ field.
3. Enter a time interval in the __Interval__ field.

The time interval is the amount of time for Grafana to stay on a particular Dashboard before advancing to the next one on the Playlist.

## Add a dashboard to a playlist

To add a dashboard:

1. Click the __Find dashboards by name__ field.
2. Search for the playlist by name or regular expression.
   - You can also filter your results by starred status or tags.

     By default, your starred dashboards will appear as options to add to the Playlist.
3. Click __Add to playlist__ next to the dashboard you want to add.
   - Click on __Remove[x]__ to remove a dashboard from the playlist.

The Playlist is essentially a list of dashboards. Be sure that all the dashboards you want to appear in your playlist are added in this section before saving the playlist.

## Save a playlist

To save a playlist: 

1. Ensure that your Playlist has a __Name__, __Interval__, and at least one (1) __Dashboard__ added to it.
2. Click the green __Create__ button.

   This will generate a unique, shareable URL for your playlist.

 Click on the generated URL to start the Playlist from here. If you want to share the URL, right click on the URL and copy the URL link and share.

## Start a playlist

To start a playlist: 

1. From the Dashboard submenu, click __Playlists__.
2. Next to the playlist you want to start, click __Start Playlist__.
3. In the dropdown, select the mode you want the playlist to display in.
   - In Normal mode
   - In TV mode
   - In TV mode (with auto fit panels)
   - In Kiosk mode
   - In Kiosk mode (with auto fit panels)

### Normal, TV and Kiosk mode

__Normal mode:__ The side menu remains visible. The navbar, row and panel controls appear at the top of the screen.

__TV mode:__ The side mmenu is hidden/removed. The navbar, row and panel controls appear at the top of the screen.

A playlist enters __TV mode__ automatically after one minute of user inactivity. To toggle it manually, 
use the `d v` sequence shortcut, or append the parameter `?inactive` to the dashboard URL. Restore the navbar and controls with any mouse movement or keyboard action.

__Kiosk mode:__ The side menu, navbar, row and panel controls are completely hidden/removed from view. 

To put a playlist into __Kiosk__ mode, use the `d k` shortcut after the playlist has started. Toggle the playlist out of kiosk mode with the same shortcut.

## Control a playlist

To control a playlist:

1. While in __Normal__ or __TV__ mode, locate the Playlist navbar and controls at the top of the screen.

   Note: A playlist cannot be controlled manually in __Kiosk__ mode.

2. Click the __next__ button (right arrow) to advance to the next dashboard. 
3. Click the __back__ button (left arrow) in the navbar to return to the previous dashboard. 
4. Click the square __Stop__ button to stop the playlist. This will exit to the current Dashboard.

>Shortcut: Click the __Esc__ key to stop the playlist from your keyboard.

### Link to a playlist in Kiosk mode

To create a link to a playlist with kiosk mode enabled:

1. Copy the Start URL (right click the __Play__ button and choose __Copy link address__).
2. Add the `?kiosk` parameter to the URL.

For example, to open the first playlist on the Grafana Play site in Kiosk mode, the URL should look like this:
[http://play.grafana.org/playlists/play/1?kiosk](http://play.grafana.org/playlists/play/1?kiosk).
