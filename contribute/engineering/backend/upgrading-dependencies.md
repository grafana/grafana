# Upgrading dependencies

Notes on upgrading various backend dependencies.

# Protobuf

When upgrading the [protobuf](http://github.com/golang/protobuf) library in Grafana and the plugin SDK, it might be 
wise to test that things still work:

* Test a plugin built with upgraded SDK on upgraded Grafana
* Test a plugin built with non-upgraded SDK on upgraded Grafana
* Test a plugin built with upgraded SDK on non-upgraded Grafana
