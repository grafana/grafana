package common

// A topic is attached to DataFrame metadata in query results.
// This specifies where the data should be used.
DataTopic: "series" | "annotations" @cuetsy(kind="enum",memberNames="Series|Annotations")