# Intent API devenv

This devenv stands up a `kube-apiserver` and a single-host `etcd` for local development / testing.

## kubeapi and etcd versions

You can switch to different kubeapi and etcd versions by changing the values in `.env`. Make sure that the images for those versions exist and can be pulled.

## Preparing the environment

In order to run and use `kube-apiserver` we need to setup PKI keys and certificates. This can be done with `make` - ensure that you do that before you boot up the environment, or re-create the environment after doing that in order for the changes to take effect:

```sh
# Generate certs and kubeconfig:
$ make -C devenv/docker/blocks/intentapi

# Spin up docker-compose env:
$ make devenv sources=intentapi

# Test that the environment is working correctly:
$ kubectl --kubeconfig=devenv/docker/blocks/intentapi/admin.kubeconfig api-resources
```
