---
keywords:
  - grafana
  - plugins
  - backend
  - plugin
  - backend-plugins
  - documentation
title: Plugin protocol
---

# Plugin protocol

The Grafana server uses a physical wire protocol to communicate with backend plugins. This protocol establishes a contract between Grafana and backend plugins to allow them to communicate with each other. 

## Developing with the plugin protocol

We strongly recommend that backend plugin development not be implemented directly against the protocol. Instead, we prefer that you use the [Grafana Plugin SDK for Go]({{< relref "grafana-plugin-sdk-for-go/" >}}) that implements this protocol and provides higher-level APIs.

If you choose to develop against the plugin protocol directly, you can do so using [Protocol Buffers (that is, protobufs)](https://developers.google.com/protocol-buffers) with [gRPC](https://grpc.io/).

The plugin protocol protobufs are available in the [GitHub repository](https://github.com/grafana/grafana-plugin-sdk-go/blob/master/proto/backend.proto). 

{{% admonition type="note" %}}
The plugin protocol lives in the [Grafana Plugin SDK for Go]({{< relref "grafana-plugin-sdk-for-go/" >}}) because Grafana itself uses parts of the SDK as a dependency.
{{% /admonition %}}

## Versioning

From time to time, Grafana will offer additions of services, messages, and fields in the latest version of the plugin protocol. We don't expect these updates to introduce any breaking changes. However, if we must introduce breaking changes to the plugin protocol is needed, then we'll create a new major version of the plugin protocol.

Grafana will release new major versions of the plugin protocol alongside new major Grafana releases. When this happens, we'll then support both the old and the new plugin protocol for some time to make sure existing backend plugins continue to work.

The plugin protocol attempts to follow Grafana's versioning, However, that doesn't mean that we will automatically create a new major version of the plugin protocol when a new major release of Grafana is released.

## Writing plugins without Go

If you want to write a backend plugin in a language other than Go, then it’s possible as long as the language supports [gRPC](https://grpc.io/). However, we recommend developing your plugin in Go for several reasons: 

- We offer an official [SDK]({{< relref "grafana-plugin-sdk-for-go/" >}}).
- The compiled output is a single binary.
- Building and compiling your plugin for multiple platforms is easy.
- In most cases, the compiled binary can run "everywhere" without needing additional dependencies installed on the target platform.
- There are small footprints for binary size and resource usage.
