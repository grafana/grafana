This package supports the [Feature toggle admin page](https://grafana.com/docs/grafana/latest/administration/feature-toggles/) feature. 

In order to update feature toggles through the app, the PATCH handler calls a webhook that should update Grafana's configuration and restarts the instance. 

For local development, set the app mode to `development` by adding `app_mode = development` to the top level of your Grafana .ini file.