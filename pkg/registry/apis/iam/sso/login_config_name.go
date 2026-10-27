package sso

// LoginConfigName is the singleton name for the pre-auth login-config read.
//
// This security backport intentionally excludes the public login-config endpoint
// feature (grafana/grafana#132576) that the real route lives behind — only this
// constant is needed, because the settings-RBAC authorizer (grafana/grafana#132762)
// carves out "~" as a public, secret-free singleton. With no route registered for
// it in this branch, that carve-out is unreachable: there is no handler that can
// ever produce an authorization check with this name.
const LoginConfigName = "~"
