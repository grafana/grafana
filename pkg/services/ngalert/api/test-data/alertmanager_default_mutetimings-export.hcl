resource "grafana_mute_timing" "mute_timing_28f674b3cd26d778" {
  name = "interval-1"
}
resource "grafana_mute_timing" "mute_timing_28f674b3cd26d77b" {
  name = "interval-2"

  intervals {

    times {
      start = "10:00"
      end   = "12:00"
    }

    weekdays      = ["monday", "wednesday", "friday"]
    days_of_month = ["1", "14:16", "20"]
    months        = ["1:3", "7", "12"]
    years         = ["2023:2025"]
    location      = "America/New_York"
  }
}
