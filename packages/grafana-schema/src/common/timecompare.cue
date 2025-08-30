package common

// Options for time comparison
TimeCompareOptions: {
  // Enable time comparison control
  timeCompare?: bool
  // Align time shifts for comparison series
  alignTimeShifts?: bool | *true
} @cuetsy(kind="interface") 