package object

// ObjectSummaryBuilder will read an object and create the summary.
// This should not include values that depend on system state, only the raw object
type ObjectSummaryBuilder = func(obj RawObject) (ObjectSummary, error)
