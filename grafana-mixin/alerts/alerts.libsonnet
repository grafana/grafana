{
  _config+:: {
    grafanaRequestsFailingThresholdPercent: 50,
  },

  prometheusAlerts+:: {
    groups+: [
      {
        name: 'GrafanaAlerts',
        rules: [
          {
            alert: 'GrafanaRequestsFailing',
            expr: |||
              100 * namespace_job_handler_statuscode:grafana_http_request_duration_seconds_count:rate5m{handler!~"/api/datasources/proxy/:id.*|/api/ds/query|/api/tsdb/query", status_code=~"5.."}
              / ignoring (status_code) group_left
              sum without (status_code) (namespace_job_handler_statuscode:grafana_http_request_duration_seconds_count:rate5m{handler!~"/api/datasources/proxy/:id.*|/api/ds/query|/api/tsdb/query"})
              > %(grafanaRequestsFailingThresholdPercent)s
            ||| % $._config,
            labels: {
              severity: 'warning',
            },
            annotations: {
              message: '{{ $labels.namespace }}/{{ $labels.job }}/{{ $labels.handler }} is experiencing {{ $value | humanize }}% errors',
            },
            'for': '5m',
          },
        ],
      },
    ],
  },
}
