Create or Update a secret:

```
curl -X POST \
    -H 'Content-Type: application/yaml' \
    --data-binary '@secure-value-default-generate.yaml' \
    'http://admin:admin@localhost:3000/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues'
```

List secrets:

```
curl 'http://admin:admin@localhost:3000/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues'
```

Get a secret:

```
curl 'http://admin:admin@localhost:3000/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues/xyz'
```

Delete a secret:

```
curl -X DELETE 'http://admin:admin@localhost:3000/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues/xyz'
```
