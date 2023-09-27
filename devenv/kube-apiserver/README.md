# kube-apiserver for storage testing

Start the apiserver with the following command:

```bash
make devenv-apiserver
```

`kubectl` can be used to interact with the apiserver:
```bash
export KUBECONFIG=$PWD/devenv/kube-apiserver/kubeconfig
kubectl api-resources
```


