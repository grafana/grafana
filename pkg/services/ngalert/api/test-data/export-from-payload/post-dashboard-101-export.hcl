resource "grafana_rule_group" "rule_group_0000" {
  org_id           = 1
  name             = "Graphite 4 - 1m"
  folder_uid       = "e4584834-1a87-4dff-8913-8a4748dfca79"
  interval_seconds = 60

  rule {
    name      = "name1"
    condition = "B"

    data {
      ref_id = "A"

      relative_time_range {
        from = 300
        to   = 0
      }

      datasource_uid = "graphite2-uid"
      model          = "{\"intervalMs\":200,\"maxDataPoints\":1500,\"refId\":\"A\",\"target\":\"aliasByNode(statsd.fakesite.counters.session_start.desktop.count, 4)\"}"
    }
    data {
      ref_id = "B"

      relative_time_range {
        from = 0
        to   = 0
      }

      datasource_uid = "__expr__"
      model          = "{\"conditions\":[{\"evaluator\":{\"params\":[100],\"type\":\"\\u003e\"},\"operator\":{\"type\":\"\"},\"query\":{\"params\":[\"A\"]},\"reducer\":{\"type\":\"avg\"}}],\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"B\",\"type\":\"classic_conditions\"}"
    }

    no_data_state  = "NoData"
    exec_err_state = "Alerting"
    for            = "2m"
    annotations = {
      __dashboardUid__ = "graphite-4"
      __panelId__      = "3"
      message          = "desc1"
    }
    labels    = {}
    is_paused = false
  }
  rule {
    name      = "name2"
    condition = "A"

    data {
      ref_id = "A"

      relative_time_range {
        from = 0
        to   = 0
      }

      datasource_uid = "__expr__"
      model          = "{\"conditions\":[{\"evaluator\":{\"params\":[100],\"type\":\"\\u003e\"},\"operator\":{\"type\":\"\"},\"query\":{\"params\":[\"B\"]},\"reducer\":{\"type\":\"avg\"}}],\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"A\",\"type\":\"classic_conditions\"}"
    }
    data {
      ref_id = "B"

      relative_time_range {
        from = 300
        to   = 0
      }

      datasource_uid = "graphite2-uid"
      model          = "{\"intervalMs\":200,\"maxDataPoints\":1500,\"refId\":\"B\",\"target\":\"aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)\"}"
    }

    no_data_state  = "NoData"
    exec_err_state = "Alerting"
    annotations = {
      __dashboardUid__ = "graphite-4"
      __panelId__      = "4"
      message          = "desc2"
    }
    labels    = {}
    is_paused = false
  }
}
