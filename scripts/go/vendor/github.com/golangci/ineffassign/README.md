# ineffassign
Detect ineffectual assignments in Go code.

This tool misses some cases because does not consider any type information in its analysis.  (For example, assignments to struct fields are never marked as ineffectual.)  It should, however, never give any false positives.
