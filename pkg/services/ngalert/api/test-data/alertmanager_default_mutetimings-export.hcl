resource "grafana_mute_timing" "mute_timing_9e85e7a27b8f12ca" {
  name = "interval"
}
resource "grafana_mute_timing" "mute_timing_b469bb50150a4298" {
  name = "full-interval"

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
