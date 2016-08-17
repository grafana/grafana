---
page_title: Playlist Guide
page_description: Playlist guide for Grafana
page_keywords: grafana, playlist, documentation
---

# Playlist

The Playlist is a special type of Dashboard that rotates through a list of Dashboards. A Playlist can be a great way to build situational awareness, or just show off your metrics to your team or visitors.

Since Grafana automatically scales Dashboards to any resolution they're perfect for big screens!

## Creating a Playlist

The Playlist feature can be accessed from Grafana's sidemenu. Click the 'Playlist' button from the sidemenu to access the Playlist functionality. When 'Playlist' button is clicked, playlist view will open up showing saved playlists and an option to create new playlists.

<img src="/img/v3/playlist.png" class="no-shadow">

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
