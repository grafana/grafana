# k8s-proof-of-concept

This readme is a temporary place for capturing any essential development
environment details for the POC. Once the code lands in main, any pertinent
documentation should be absorbed into existing readmes in standard places.

## make targets

1. `make clean-k8s`:  deletes the temporary `data/k8s` directory altogether.
You will lose all objects in your kubernetes storage. `make clean` also
accomplishes this in addition to cleaning up frontend dev toolchain.
2. `make clean-k8s-certs`: only deletes the certificates and is provided for
you to be able to test things around `cert-generator` or in case of inadvertent
partial deletion of your K8s PKI.

## Certificates

A dskit service called `cert-generator` is now available in the modules
registry and is responsible for provisioning TLS certificates used by K8s
as well as Grafana's HTTP Server on port 2999.

The certificates are generated in `data/k8s` directory. For
resetting the certificates when you see an error of the form:

```
error verifiing existing cert (subject=some-subject) for a sanity check
Did you delete the original CA cert used for issuing it?
If so, try reseting your PKI to resolve this problem
```

Run a `make clean-k8s-certs` as mentioned above.


## Stateful Directories

1. `data/k8s`: this directory is gitignored but is ensured to exist by 
`cert-generator` and `kine`. Once existent, it ends up holding all the
temporary k8s things such as certificates as well as the SQLite database
powering Kine.
   1. `grafana.kubeconfig`: The `kubectl` configuration provided here
   is apiserver loopback config. While this is mostly an internal detail of
   how apiserver manages itself, its currently exposed to support development.
   `./bin/grafana kubectl` command utilizes this kubeconfig. If not present,
   this config file is created when apiserver boots.

## Configuration

1. **Authentication Webhook**: the config for K8s webhook authentication
is located in [k8s-authn-webhook-config](../../../conf/k8s-authn-webhook-config).
   1. This currently supports using a glsa token from a Grafana service account
   having `Admin` role. The kubeconfig can be constructed from 
   `../../../data/k8s/grafana.kubeconfig` with the token swapped with a
   glsa token.
