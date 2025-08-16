To run the operator locally you need to run the following commands:

1. Setup the proxies into dev-us-central-0:

```
kubectl --context dev-us-central-0 port-forward svc/api-lb 8080:80 -n auth & \
kubectl --context dev-us-central-0 -n grafana-folder port-forward svc/folder-grafana-app-main 6446:6443
```

2.  Get the AUTH_TOKEN and paste it into ./local/yamls/operator.yaml:

```
kubectl --context dev-us-central-0 -n grafana-iam get secret iam-grafana-app-main-system-cap -o json | jq -r '.data.token' | base64 -d
```

3. You may need to modify `FOLDER_APP_URL` and `AUTH_TOKEN_EXCHANGE_URL` to match your local config
4. Run the local cluster.

```
make local/up
```

5. The operator will fail to start since it's cluster can't find the docker image to run so you'll have to push the image to the cluster

```
make deps & make local/push_operator
```

The operator should now start succesfully. For now it is configured to only list folders in a single stack.

```
ReconcileOptions: simple.BasicReconcileOptions{
    Namespace: "stacks-8108",
}
```
