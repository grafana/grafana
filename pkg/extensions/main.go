//go:build !enterprise && !pro
// +build !enterprise,!pro

package extensions

// Imports used by Grafana enterprise are in enterprise_imports.go (behind a build tag).

const IsEnterprise bool = false
