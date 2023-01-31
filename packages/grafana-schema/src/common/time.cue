package common

// Use UTC/GMT timezone
TimeZoneUtc: "utc"  @cuetsy(kind="type")

// Use the timezone defined by end user web browser
TimeZoneBrowser: "browser"  @cuetsy(kind="type")

// A specific timezone from https://en.wikipedia.org/wiki/Tz_database
TimeZone: TimeZoneUtc | TimeZoneBrowser | string | *"browser" @cuetsy(kind="type")
