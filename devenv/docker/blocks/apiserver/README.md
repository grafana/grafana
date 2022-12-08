# K8s apiserver devenv

This devenv stands up a `kube-apiserver` and a single-host `etcd` for local development / testing.

## kubeapi and etcd versions

You can switch to different kubeapi and etcd versions by changing the values in `.env`. Make sure that the images for those versions exist and can be pulled.

## Preparing the environment

In order to run and use `kube-apiserver` we need to setup PKI keys and certificates. This can be done with `make` - ensure that you do that before you boot up the environment, or re-create the environment after doing that in order for the changes to take effect:

```sh
# Generate certs and kubeconfig:
$ make -C devenv/docker/blocks/apiserver
# Spin up docker-compose env:
$ make devenv sources=apiserver
# Test that the environment is working correctly:
$ kubectl --kubeconfig=devenv/docker/blocks/apiserver/apiserver.kubeconfig api-resources
```

## Using the Intent API in Grafana

Make sure you have the environment up & running, then run Grafana with Intent API specific settings:

```sh
# Build Grafana server:
$ make build-go
# Run with Intent API specific config:
$ GF_FEATURE_TOGGLES_ENABLE=apiserver \
GF_APISERVER_SERVER_CERT_FILE_PATH=devenv/docker/blocks/apiserver/certs/apiserver.pem \
GF_APISERVER_SERVER_KEY_FILE_PATH=devenv/docker/blocks/apiserver/certs/apiserver-key.pem \
GF_APISERVER_KUBEBRIDGE_KUBECONFIG_PATH=devenv/docker/blocks/apiserver/apiserver.kubeconfig \
GF_LOG_LEVEL=debug \
make run
# Test it:
$ kubectl --kubeconfig=devenv/docker/blocks/apiserver/apiserver.kubeconfig api-resources
```
