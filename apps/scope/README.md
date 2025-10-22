# Updating OpenAPI spec

Change the desired types, then run these commands, with the linked Enterprise repo:

```
go test --tags "pro" -timeout 30s -run ^TestIntegrationOpenAPIs$ github.com/grafana/grafana/pkg/extensions/apiserver/tests -count=1
```

```
./hack/update-codegen.sh scope
```
