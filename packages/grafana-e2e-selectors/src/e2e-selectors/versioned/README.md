# Versioned selectors

All selectors defined in this directory should be associated with a minimum Grafana version. If for example the value of the DataSourcePicker.container selector was changed in Grafana 10.0.0, a new key-value pair for the combination of Grafana version and selector value needs to be added. Beware that the minimum version resolver follow strict semver, so if you've introduced the change in 10.0.0 but it's been backported to 9.5.6, you should specify 9.5.6 as the minimum Grafana version.

You can find more information about versioned selectors in the [contributing guidelines](https://github.com/grafana/plugin-tools/blob/main/packages/plugin-e2e/CONTRIBUTING.md#fix-broken-e2e-selectors).
