resource "grafana_notification_policy" "notification_policy_1" {
  name          = "empty"
  contact_point = "default-receiver"
  group_by      = []
}
