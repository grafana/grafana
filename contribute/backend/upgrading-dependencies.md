# Upgrading dependencies

When upgrading the various backend dependencies of Grafana, we recommend the following practices.

## Protocol buffers (protobufs)

Use the most recent stable version of the [protobuf library](http://github.com/golang/protobuf) in Grafana and the plugin SDK. 

Additionally, you typically want to upgrade your protobuf compiler toolchain and re-compile the protobuf files.

> **Note:** You need Buf CLI installed and available in your path. For instructions, refer to the [Buf Docs documentation](https://buf.build/docs/installation).

After you've installed Buf CLI, re-compile the protobuf files in Grafana and the plugin SDK. Use the following code:

```shell
cd $GRAFANA
make protobuf
cd $GRAFANA_PLUGIN_SDK_GO
mage protobuf
```

After upgrading the protobuf dependency in Grafana and the plugin SDK, it is a best practice to test that your code still works before making corresponding PRs. Specifically:

- Test a plugin built with upgraded SDK on upgraded Grafana
- Test a plugin built with non-upgraded SDK on upgraded Grafana
- Test a plugin built with upgraded SDK on non-upgraded Grafana
