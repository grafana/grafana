{
  grafanaDashboards: {
    'grafana-overview.json': (import 'dashboards/grafana-overview.json'),
  },

  // Helper function to ensure that we don't override other rules, by forcing
  // the patching of the groups list, and not the overall rules object.
  local importRules(rules) = {
    groups+: std.native('parseYaml')(rules)[0].groups,
  },

  prometheusRules+: importRules(importstr 'rules/rules.yaml'),

  prometheusAlerts+: importRules(importstr 'alerts/alerts.yaml'),
}
