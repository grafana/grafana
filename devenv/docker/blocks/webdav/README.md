# README for the image storage WebDAV docker block

This block is used for testing the [WebDAV](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#external_image_storagewebdav) option for external image storage which is used in [alert notifications](https://grafana.com/docs/grafana/latest/alerting/manage-notifications/images-in-notifications/). This uses the simplest WebDav server that is still being maintained, a project called [Dufs](https://github.com/sigoden/dufs).

## Using Dufs

Dufs has a web UI that can be accessed at http://localhost:5000 to easily see which files have been uploaded by Grafana. The config has disabled authentication and allows everyone to read and write files.

## Configuring image storage in Grafana to use Dufs

An example config for external image storage with webdav enabled:

```ini
[external_image_storage]
provider = webdav

[external_image_storage.webdav]
url = http://127.0.0.1:5000/images
public_url = http://127.0.0.1:5000/images/{{file}}

; as auth is not configured in Dufs, these are just dummy values
username = test
password = test
```

Note: As everything runs on localhost, the image in an email notification will be broken but the link will work if you click on it and open it in your browser.
