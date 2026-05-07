resource "grafana_notification_policy" "notification_policy_1" {
  contact_point = "provisioned-contact-point"
  group_by      = ["alertname"]

  policy {
    contact_point = "lotsa-emails"
    group_by      = ["alertname", "grafana_folder"]

    matcher {
      label = "severity"
      match = "="
      value = "critical"
    }

    mute_timings   = ["A provisioned interval"]
    active_timings = ["Some interval"]
    continue       = true

    policy {
      contact_point = "lotsa-emails-override"
      group_by      = ["alertname", "grafana_folder", "one_more_group"]

      matcher {
        label = "severity"
        match = "!="
        value = "critical"
      }

      mute_timings    = ["A provisioned interval override"]
      active_timings  = ["Some interval override"]
      group_wait      = "1m40s"
      group_interval  = "1h40m"
      repeat_interval = "4d4h"
    }

    group_wait      = "10s"
    group_interval  = "10m"
    repeat_interval = "10h"
  }
  policy {
    contact_point = ""

    matcher {
      label = "severity"
      match = "="
      value = "warn"
    }

    policy {
      contact_point = ""

      matcher {
        label = "severity"
        match = "="
        value = "warn"
      }
    }
  }

  group_wait      = "1s"
  group_interval  = "1m"
  repeat_interval = "1h"
}
