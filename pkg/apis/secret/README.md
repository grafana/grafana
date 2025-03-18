# pkg/apis/secret

General documentation on the Secrets API for App Platform.

## Regenerating codegen files

Currently the generated files are not using `grafana-app-sdk` and does not have a CUE schema definition.

In order to regenerate the codegen files (those prefixed by `zz_`), you can run:
```sh
./hack/update-codegen.sh secret
```

More details [here](https://github.com/grafana/grafana/tree/main/hack#kubernetes-hack-alert).

## Regenerating Protobuf files

```sh
make protobuf
```
