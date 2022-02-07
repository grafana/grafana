{
  prometheusRules+:: {
    groups+: [
      {
        name: 'grafana_rules',
        rules: [
          {
            record: 'namespace_job_handler_statuscode:grafana_http_request_duration_seconds_count:rate5m',
            expr: |||
              sum by (namespace, job, handler, status_code) (rate(grafana_http_request_duration_seconds_count[5m]))
            |||,
          },
        ],
      },
    ],
  },
}
