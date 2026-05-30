---
name: ds-proxy-wrapper-branch
description: Architecture of the ds-proxy-wrapper branch decoupling the datasource HTTP proxy for apiserver integration
metadata:
  type: project
---

The `ds-proxy-wrapper` branch decouples the legacy datasource HTTP proxy (`pkg/api/pluginproxy`) from heavy deps so it can run inside the datasources apiserver.

Key pieces:

- `pluginproxy.DataSourceLoader` interface (loader.go) narrows the dependency from full `datasources.DataSourceService` to a small async-friendly surface returning the apiserver type `datasourcesV0.DataSource`. `loaderFromService` is the legacy-backed impl.
- `pluginproxy.HTTPContext` replaces `*contextmodel.ReqContext`; identity comes from `identity.GetRequester(ctx.Req.Context())`. Permissions use `requester.GetPermissions()` (the `GetPermissions` field was removed).
- URL validation moved from `pkg/api/datasource` to `pkg/api/datasource/validation` to break an import cycle.
- apiserver wiring: `datasource.ProvideProxyDependencies` (wire provider in `pkg/registry/apis/wireset.go`) builds a single `*ProxyDependencies` (ProxyCfg, validator, httpclient, oauth, tracer, features) instead of threading each into `RegisterAPIService`. `subProxyREST.Connect` (sub_proxy.go) builds a loader, validates, then runs `NewDataSourceProxy`.
- The proxy loader for the apiserver path is `providerLoader` (proxy_loader.go): it adapts the existing `PluginDatasourceProvider` (via its public `GetDataSource` + `GetInstanceSettings`) into a `pluginproxy.DataSourceLoader`. Decrypted secrets come from `InstanceSettings.DecryptedSecureJSONData` (password/basicAuthPassword keys); transport from `InstanceSettings.HTTPClientOptions`. Deliberately NOT a method on `PluginDatasourceProvider` — keep that interface clean.

After changing `RegisterAPIService` signature, regenerate wire with: `go run ./pkg/build/wire/cmd/wire/main.go gen -tags "oss" -gen_tags "(!enterprise && !pro)" ./pkg/server` (plain `wire` fails — needs the oss build tag for `wireExtsSet`).

Plan: make all changes here, then split into reviewable chunks (frontend/backend separate PRs per repo convention).
