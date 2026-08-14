resource "grafana_notification_policy" "notification_policy_1" {
  contact_point = "lotsa-emails"
  group_by      = ["alertname"]

  policy {
    contact_point = ""

    matcher {
      label = "severity"
      match = "="
      value = "warn"
    }
  }
  policy {
    contact_point = ""

    matcher {
      label = "severity"
      match = "=~"
      value = "critical"
    }
  }
  policy {
    contact_point = ""

    matcher {
      label = "severity"
      match = "!~"
      value = "info"
    }
  }
  policy {
    contact_point = ""

    matcher {
      label = "severity"
      match = "!="
      value = "debug"
    }
  }

  group_wait      = "2s"
  group_interval  = "2m"
  repeat_interval = "2h"
}
