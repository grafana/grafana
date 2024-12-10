# Creating a Feedback

1. Export the `KUBECONFIG` var:
```sh
export KUBECONFIG=$PWD/data/grafana-apiserver/grafana.kubeconfig
```

2. Apply the resource:
```sh
kubectl apply -f apps/feedback/feedback-xyz.yaml
```

3. Head to:
```
http://localhost:3000/apis/feedback.grafana.app/v0alpha1/namespaces/default/feedbacks/xyz
```
