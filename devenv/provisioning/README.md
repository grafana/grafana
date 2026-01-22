## Setup

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

The preview is actually based on:
http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/non-sync-repo/files/hello.json

this includes the output of what happens with `dryRun` applied to whatever is saved (nothing in this case)

note you can edit and save
