# Upgrading dependencies

Notes on upgrading various backend dependencies.

# Protobuf

When upgrading the [protobuf](http://github.com/golang/protobuf) library in Grafana and the plugin SDK,
you typically also want to upgrade your protobuf compiler toolchain and re-compile protobuf files:

```
cd $GRAFANA
make protobuf
cd $GRAFANA_PLUGIN_SDK_GO
mage protobuf
```

After upgrading the protobuf dependency in Grafana and the plugin SDK, it might be wise to test that things still work,
before making corresponding PRs:

- Test a plugin built with upgraded SDK on upgraded Grafana
- Test a plugin built with non-upgraded SDK on upgraded Grafana
- Test a plugin built with upgraded SDK on non-upgraded Grafana
