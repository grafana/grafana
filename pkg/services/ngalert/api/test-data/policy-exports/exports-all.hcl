resource "grafana_notification_policy" "notification_policy_1" {
  name          = "deeply-nested"
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
resource "grafana_notification_policy" "notification_policy_2" {
  name          = "empty"
  contact_point = "default-receiver"
  group_by      = []
}
resource "grafana_notification_policy" "notification_policy_3" {
  name          = "matcher-variety"
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
resource "grafana_notification_policy" "notification_policy_4" {
  name          = "override-inherit"
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
resource "grafana_notification_policy" "notification_policy_5" {
  name          = "special-cases"
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
resource "grafana_notification_policy" "notification_policy_6" {
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
