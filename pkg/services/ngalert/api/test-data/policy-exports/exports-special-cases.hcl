resource "grafana_notification_policy" "notification_policy_1" {
  contact_point = "default-receiver"
  group_by      = ["..."]

  policy {
    contact_point = ""

    matcher {
      label = "utf8"
      match = "="
      value = "🤖🔥✨👩🏽\u200d💻🚀🧪🧠😂💥🫠🇨🇦"
    }
  }
  policy {
    contact_point = ""
  }
  policy {
    contact_point = ""

    matcher {
      label = "path"
      match = "=~"
      value = "^/api/v[0-9]+/\\p{L}[\\p{L}\\p{N}_\\-]*$"
    }
    matcher {
      label = "special_regex_chars"
      match = "="
      value = ".*+?^()|[]\\"
    }
  }
}
