export enum SupportedPlugin {
  Incident = 'grafana-incident-app',
  OnCall = 'grafana-oncall-app',
  Irm = 'grafana-irm-app',
  MachineLearning = 'grafana-ml-app',
  Labels = 'grafana-labels-app',
  Slo = 'grafana-slo-app',
  Assistant = 'grafana-assistant-app',
  /** Owns the data source managed alerting experience (Prometheus-flavoured rules and external Alertmanagers) */
  PrometheusAlerting = 'grafana-prometheusalerting-app',
}
