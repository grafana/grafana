resource "grafana_notification_policy" "notification_policy_1" {
  contact_point = "slack-multi-channel"
  group_by      = ["alertname"]

  policy {
    contact_point = ""

    matcher {
      label = "level"
      match = "="
      value = "one"
    }

    policy {
      contact_point = ""

      matcher {
        label = "level"
        match = "="
        value = "two"
      }

      policy {
        contact_point = ""

        matcher {
          label = "level"
          match = "="
          value = "three"
        }

        policy {
          contact_point = ""

          matcher {
            label = "level"
            match = "="
            value = "four"
          }

          policy {
            contact_point = ""

            matcher {
              label = "level"
              match = "="
              value = "five"
            }
          }
        }
      }
    }
  }

  group_wait      = "3s"
  group_interval  = "3m"
  repeat_interval = "3h"
}
