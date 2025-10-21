To build the operator, simply run `make build-go`

To run the folder reconciler, you need a `./conf/operator.ini` config file. For example:
```
[grpc_client_authentication]
token = IamFolderReconcilerToken
token_exchange_url = http://host.docker.internal:8080/v1/sign-access-token

[operator]
folder_app_url = https://host.docker.internal:6446
zanzana_url = zanzana.default.svc.cluster.local:50051
tls_insecure = true
```
After that, you can run it using: `GF_DEFAULT_TARGET=operator GF_OPERATOR_NAME=iam-folder-reconciler ./bin/linux-arm64/grafana server target --config=conf/operator.ini`. Beware that you will also need a TokenExchanger, a Zanzana Server and a Folder app running for the operator to behave. 
