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

The Playlist is a special type of Dashboard that rotates through a list of Dashboards. A Playlist can be a great way to build situational awareness, or just show off your metrics to your team or visitors.

Since Grafana automatically scales Dashboards to any resolution they're perfect for big screens!

## Creating a Playlist

{{< docs-imagebox img="/img/docs/v50/playlist.png" max-width="25rem" class="docs-image--right">}}

The Playlist feature can be accessed from Grafana's sidemenu, in the Dashboard submenu.

Click on "New Playlist" button to create a new playlist. Firstly, name your playlist and configure a time interval for Grafana to wait on a particular Dashboard before advancing to the next one on the Playlist.

You can search Dashboards by name (or use a regular expression), and add them to your Playlist. Or you could add tags which will include all the dashboards that belongs to a tag when the playlist start playing. By default, your starred dashboards will appear as candidates for the Playlist.

Be sure to click the "Add to dashboard" button next to the Dashboard name to add it to the Playlist. To remove a dashboard from the playlist click on "Remove[x]" button from the playlist.

Since the Playlist is basically a list of Dashboards, ensure that all the Dashboards you want to appear in your Playlist are added here.

## Saving the playlist

Once all the wanted dashboards are added to a playlist, you can save this playlist by clicking on the green "Save" button. This will generate a unique URL for you playlist which can be shared if needed. Click on the generated URL or on the "Play" button from the "Saved playlists" list to start the playlist. If you want to share the URL, right click on the URL and copy the URL link and share.

## Starting the playlist

Also, if you want, you can start the playlist without saving it by clicking on the green "Start" button at the bottom.

## Controlling the Playlist

Playlists can also be manually controlled utilizing the Playlist controls at the top of screen when in Playlist mode.

Click the stop button to stop the Playlist, and exit to the current Dashboard.
Click the next button to advance to the next Dashboard in the Playlist.
Click the back button to rewind to the previous Dashboard in the Playlist.

## TV or Kiosk Mode

In TV mode the top navbar, row & panel controls will all fade to transparent.

This happens automatically after one minute of user inactivity but can also be toggled manually
with the `d v` sequence shortcut, or by appending the parameter `?inactive` to the dashboard URL. Any mouse movement or keyboard action will
restore navbar & controls.

Another feature is the kiosk mode - in kiosk mode the navbar is completely hidden/removed from view. This can be enabled with the `d k`
shortcut.

To put a playlist into kiosk mode, use the `d k` shortcut after the playlist has started. The same shortcut will toggle the playlist out of kiosk mode.

### Linking to the Playlist in Kiosk Mode

If you want to create a link to the playlist with kiosk mode enabled:

1. Copy the Start Url (by right clicking on the Play button and choosing Copy link address).
2. Add the `?kiosk` parameter to the url.

For example, to open the first playlist on the Grafana Play site in kiosk mode: [http://play.grafana.org/playlists/play/1?kiosk](http://play.grafana.org/playlists/play/1?kiosk)
