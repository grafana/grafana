# Grafana TestData data source

This data source is used for testing and development of Grafana. Generates test data in different forms.

> **Experimental**: By default, Grafana ships with TestData built in. This behavior can be changed via the `externalCorePlugins` [feature toggle](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/) and the configuration field `plugin.grafana-testdata-datasource.as_external`. These settings, if enabled, allows you to to install TestData as an external plugin and manage its lifecycle independently of Grafana.
>
> With the feature toggle disabled (default) TestData can still be installed as an external plugin, but it has no effect as the bundled, Core version of TestData is already installed and takes precedence.
