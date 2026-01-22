== Setup

Run grafana with configuration:

```
[feature_toggles]
provisioning = true

[paths]
permitted_provisioning_paths = devenv
```

Use kubectl to add repository

```
export KUBECONFIG=$PWD/data/grafana-apiserver/grafana.kubeconfig
```

```
kubectl apply -f ./devenv/provisioning/non-sync-repo.yaml
```

Then visit:

- http://localhost:3000/admin/provisioning
- http://localhost:3000/admin/provisioning/non-sync-repo?tab=resources

No current links from the UI (since kinda wonky)

- http://localhost:3000/admin/provisioning/non-sync-repo/file/hello.json
- http://localhost:3000/admin/provisioning/non-sync-repo/dashboard/preview/hello.json

note you can edit and save
