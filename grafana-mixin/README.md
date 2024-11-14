# Grafana Mixin

_This is a work in progress. We aim for it to become a good role model for alerts
and dashboards eventually, but it is not quite there yet._

The Grafana Mixin is a set of configurable, reusable, and extensible alerts and
dashboards based on the metrics exported by Grafana. The mixin creates
recording and alerting rules for Prometheus and suitable dashboard descriptions
for Grafana.

To use them, you need to have `mixtool` and `jsonnetfmt` installed. If you
have a working Go development environment, it's easiest to run the following:

```bash
$ go get github.com/monitoring-mixins/mixtool/cmd/mixtool
$ go get github.com/google/go-jsonnet/cmd/jsonnetfmt
```

You can then build the Prometheus rules files `alerts.yaml` and
`rules.yaml` and a directory `dashboard_out` with the JSON dashboard files
for Grafana:

```bash
$ make build
```

For more advanced uses of mixins, see
https://github.com/monitoring-mixins/docs.
