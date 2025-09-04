To build the operator, simply run `make build-go`

To run the folder reconciler, you need a `./conf/operator.ini` config file. For example:
```
[iam_folder_reconciler]
folder_app_url = https://host.docker.internal:6446
folder_app_namespace = *
zanzana_address = zanzana.default.svc.cluster.local:50051
token_exchange_url = http://host.docker.internal:8080/v1/sign-access-token
token = ProvisioningAdminToken
```
After that, you can run it using: `GF_DEFAULT_TARGET=operator GF_OPERATOR_NAME=iam-folder-reconciler ./bin/linux-arm64/grafana server target --config=conf/operator.ini`. Beware that you will also need a TokenExchanger, a Zanzana Server and a Folder app running for the operator to behave. 
