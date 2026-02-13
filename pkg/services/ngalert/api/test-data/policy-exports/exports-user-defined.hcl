resource "grafana_notification_policy" "notification_policy_1" {
  contact_point = "default-receiver"
  group_by      = ["g1", "g2"]

  policy {
    contact_point = "nested-receiver"
    group_by      = ["g3", "g4"]

    matcher {
      label = "foo"
      match = "="
      value = "bar"
    }

    mute_timings    = ["interval"]
    active_timings  = ["active"]
    continue        = true
    group_wait      = "5m"
    group_interval  = "5m"
    repeat_interval = "5m"
  }

  group_wait      = "30s"
  group_interval  = "5m"
  repeat_interval = "1h"
}
