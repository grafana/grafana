// Package settings allows storage and retrieval of config from the database in addition to the default config file.
// It merges configuration from both sources, prioritizing what is in the database.
//
// It also adds the live-reload capability to update certain configuration on the fly, i.e. without requiring a restart of the server.
// These updates can either be made via the API, or read from the database by a chron job.
//
// This package creates new API endpoints.
// For more information, please refer to the [User docs].
//
// [User docs]: https://grafana.com/docs/grafana/latest/enterprise/settings-updates/
package settings
