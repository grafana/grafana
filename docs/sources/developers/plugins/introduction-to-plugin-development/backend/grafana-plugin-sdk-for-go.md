---
title: Grafana plugin SDK for Go
aliases:
  - ../../plugins/backend/grafana-plugin-sdk-for-go/
keywords:
  - grafana
  - plugins
  - backend
  - plugin
  - backend-plugins
  - sdk
  - documentation
description: Learn about the Grafana plugin SDK for Go, a Go module with packages for implementing a Grafana backend plugin.
---

# Grafana plugin SDK for Go

The [Grafana plugin SDK for Go](https://pkg.go.dev/mod/github.com/grafana/grafana-plugin-sdk-go?tab=overview) is a [Go](https://golang.org/) module that provides a set of [packages](https://pkg.go.dev/mod/github.com/grafana/grafana-plugin-sdk-go?tab=packages) that you can use to implement a backend plugin.

The plugin SDK provides a high-level framework with APIs, utilities, and tooling. By using the SDK, you can avoid the need to learn the details of the [plugin protocol]({{< relref "./plugin-protocol.md" >}}) and RPC communication protocol, so you don't have to manage either one.

## Versioning

The Grafana plugin Go SDK is still in development. It is based on the [plugin protocol]({{< relref "./plugin-protocol" >}}), which is versioned separately and is considered stable. However, from time to time, we might introduce breaking changes in the SDK.

When we update the plugin SDK, those plugins that use an older version of the SDK should still work with Grafana. However, these older plugins may be unable to use the new features and capabilities we introduce in updated SDK versions.

## See also

- [SDK source code](https://github.com/grafana/grafana-plugin-sdk-go)
- [Go reference documentation](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go)
