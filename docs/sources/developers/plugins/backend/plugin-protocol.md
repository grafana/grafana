+++
title = "Plugin protocol"
keywords = ["grafana", "plugins", "backend", "plugin", "backend-plugins", "documentation"]
type = "docs"
+++

# Plugin protocol

There’s a physical wire protocol that Grafana server uses to communicate with backend plugins. This is the contract between Grafana and a backend plugin that must be agreed upon for Grafana and the backend plugin to be able to communicate with eachother. The plugin protocol is built on [gRPC](https://grpc.io/) and is defined in [Protocol Buffers (a.k.a., protobuf)](https://developers.google.com/protocol-buffers).

We adwise backend plugins to not be implemented directly against this protocol. Instead, prefer to use the [Grafana Plugin SDK for Go]({{< relref "grafana-plugin-sdk-for-go.md" >}}) that implements this protocol and provides higher level API’s.

The current plugin protocol can be found [here](https://github.com/grafana/grafana-plugin-sdk-go/blob/master/proto/backend.proto). The plugin protocol lives in the [Grafana Plugin SDK for Go]({{< relref "grafana-plugin-sdk-for-go.md" >}}) since Grafana itself  uses parts of the SDK as a dependency.

## Versioning

Additions of services, messages and fields in the latest version of the plugin protocol is expected to happen, but it should not introduce any breaking changes. If breaking changes to the plugin protocol is needed, a new major version of the plugin protocol will be created and released together with a new major Grafana release. Grafana will then support both the old and the new plugin protocol for some time to make sure existing backend plugins continue to work.

Grafana owns the plugin protocol and because of that the plugin protocol sort of follows Grafana's versioning, However, that doesn't automatically mean that a new major version of the plugin protocol is created when a new major release of Grafana is released.
