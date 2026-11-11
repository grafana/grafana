The Cloudwatch datasource now lives in its own [repository](https://github.com/grafana/grafana-cloudwatch-datasource), so Grafana can no longer import from the built-in plugin directly.

Several parts of Grafana still depend on pieces of it, so this folder keeps local copies of what they need: types, icons, and dashboard migration functions. It's a temporary home until we find a cleaner solution.
