resource "grafana_rule_group" "rule_group_d3e8424bfbf66bc3" {
  org_id           = 1
  name             = "group101"
  folder_uid       = "e4584834-1a87-4dff-8913-8a4748dfca79"
  interval_seconds = 10

  rule {
    name      = "prom query with SSE - 2"
    condition = "condition"

    data {
      ref_id = "query"

      relative_time_range {
        from = 18000
        to   = 10800
      }

      datasource_uid = "000000002"
      model          = "{\"expr\":\"http_request_duration_microseconds_count\",\"hide\":false,\"interval\":\"\",\"intervalMs\":1000,\"legendFormat\":\"\",\"maxDataPoints\":100,\"refId\":\"query\"}"
    }
    data {
      ref_id = "reduced"

      relative_time_range {
        from = 18000
        to   = 10800
      }

      datasource_uid = "__expr__"
      model          = "{\"expression\":\"query\",\"hide\":false,\"intervalMs\":1000,\"maxDataPoints\":100,\"reducer\":\"mean\",\"refId\":\"reduced\",\"type\":\"reduce\"}"
    }
    data {
      ref_id = "condition"

      relative_time_range {
        from = 18000
        to   = 10800
      }

      datasource_uid = "__expr__"
      model          = "{\"expression\":\"$reduced > 10\",\"hide\":false,\"intervalMs\":1000,\"maxDataPoints\":100,\"refId\":\"condition\",\"type\":\"math\"}"
    }

    no_data_state  = "NoData"
    exec_err_state = "Alerting"
    for            = "2m"
    is_paused      = false
  }
  rule {
    name      = "reduced testdata query - 2"
    condition = "B"

    data {
      ref_id = "A"

      relative_time_range {
        from = 18000
        to   = 10800
      }

      datasource_uid = "000000004"
      model          = "{\"alias\":\"just-testing\",\"intervalMs\":1000,\"maxDataPoints\":100,\"orgId\":0,\"refId\":\"A\",\"scenarioId\":\"csv_metric_values\",\"stringInput\":\"1,20,90,30,5,0\"}"
    }
    data {
      ref_id = "B"

      relative_time_range {
        from = 18000
        to   = 10800
      }

      datasource_uid = "__expr__"
      model          = "{\"expression\":\"$A\",\"intervalMs\":2000,\"maxDataPoints\":200,\"orgId\":0,\"reducer\":\"mean\",\"refId\":\"B\",\"type\":\"reduce\"}"
    }

    no_data_state  = "NoData"
    exec_err_state = "Alerting"
    is_paused      = false

    notification_settings {
      contact_point   = "Test-Receiver"
      group_by        = ["alertname", "grafana_folder", "test"]
      group_wait      = "1s"
      group_interval  = "5s"
      repeat_interval = "5m"
      mute_timings    = ["test-mute"]
      active_timings  = ["test-mute"]
    }
  }
  rule {
    name      = "alert with uid"
    condition = "B"

    data {
      ref_id = "A"

      relative_time_range {
        from = 18000
        to   = 10800
      }

      datasource_uid = "000000004"
      model          = "{\"alias\":\"just-testing\",\"intervalMs\":1000,\"maxDataPoints\":100,\"orgId\":0,\"refId\":\"A\",\"scenarioId\":\"csv_metric_values\",\"stringInput\":\"1,20,90,30,5,0\"}"
    }
    data {
      ref_id = "B"

      relative_time_range {
        from = 18000
        to   = 10800
      }

      datasource_uid = "__expr__"
      model          = "{\"expression\":\"$A\",\"intervalMs\":2000,\"maxDataPoints\":200,\"orgId\":0,\"reducer\":\"mean\",\"refId\":\"B\",\"type\":\"reduce\"}"
    }

    no_data_state  = "NoData"
    exec_err_state = "Alerting"
    is_paused      = false

    notification_settings {
      contact_point   = "Test-Receiver"
      group_by        = ["alertname", "grafana_folder", "test"]
      group_wait      = "1s"
      group_interval  = "5s"
      repeat_interval = "5m"
      mute_timings    = ["test-mute"]
      active_timings  = ["test-mute"]
    }
  }
  rule {
    name = "recording rule"

    data {
      ref_id = "query"

      relative_time_range {
        from = 18000
        to   = 10800
      }

      datasource_uid = "000000002"
      model          = "{\"expr\":\"http_request_duration_microseconds_count\",\"hide\":false,\"interval\":\"\",\"intervalMs\":1000,\"legendFormat\":\"\",\"maxDataPoints\":100,\"refId\":\"query\"}"
    }
    data {
      ref_id = "reduced"

      relative_time_range {
        from = 18000
        to   = 10800
      }

      datasource_uid = "__expr__"
      model          = "{\"expression\":\"query\",\"hide\":false,\"intervalMs\":1000,\"maxDataPoints\":100,\"reducer\":\"mean\",\"refId\":\"reduced\",\"type\":\"reduce\"}"
    }
    data {
      ref_id = "condition"

      relative_time_range {
        from = 18000
        to   = 10800
      }

      datasource_uid = "__expr__"
      model          = "{\"expression\":\"$reduced > 10\",\"hide\":false,\"intervalMs\":1000,\"maxDataPoints\":100,\"refId\":\"condition\",\"type\":\"math\"}"
    }

    is_paused = false

    record {
      metric = "test_metric"
      from   = "condition"
    }
  }
}
