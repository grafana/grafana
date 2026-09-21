# Run Error Tracking locally

The local workflows run the independently built Error Tracking app plugin and API with PostgreSQL, signed tenant identity, and TLS. Compose is the developer loop. The kind workflow exercises the same images in Kubernetes.

Neither workflow needs a Grafana Enterprise source checkout or host Go, Node, Python, OpenSSL, or kind installation. Compose requires Docker. The Kubernetes proof also requires `kubectl`; it builds and checksum-verifies its kind executable through Docker. Grafana itself comes from the pinned public base image used by the plugin image build.

## Compose development

From the repository root:

```sh
docker compose -f deploy/local-compose/compose.yaml up --build -d
```

Open `http://localhost:3301/a/grafana-errortracking-app` and sign in with the disposable `admin/admin` account. The API listens on `https://localhost:6443`. Published ports bind to loopback.

If mise is installed, `mise run --skip-tools error-tracking-dev` starts the same workflow. Stop it without deleting data:

```sh
docker compose -f deploy/local-compose/compose.yaml down
```

The fixture initializer preserves its runtime password, 30-day certificates, PostgreSQL data, Grafana metadata, and signing keys in named volumes. Repeated `up --build` runs keep those values. Removing volumes is an explicit reset and deletes local data.

## Kubernetes acceptance

With Docker limited to 8 GiB, stop Compose before running the Kubernetes proof. The proof creates or reuses only `kind-error-tracking-native`, writes its kubeconfig to the ignored `.local-kubeconfig`, and leaves the base cluster and its data running:

```sh
deploy/local-k8s/prove-native.sh
```

With mise, the equivalent command is `mise run --skip-tools error-tracking-k8s-verify`.

The proof builds `error-tracking-api:local`, `error-tracking-local-issuer:local`, and `error-tracking-grafana:local` from this checkout through Compose. It imports them directly into the kind node. The API runs with two replicas. The plugin calls the namespaced API group through Grafana's signed App Platform route; Grafana receives no event-database credentials.

The proof covers authenticated reads and writes in stacks 11 and 22, tenant isolation, ignored tenant overrides, required calling-service permissions, unsupported actions, direct anonymous/wrong-audience/cross-tenant denial, direct API certificate validation and untrusted-certificate rejection, discovery, OpenAPI, metrics, metadata-only auditing, both API replicas, complete API outage and recovery, API and PostgreSQL restarts, readiness versus liveness, signer-key persistence, runtime credential rotation, data persistence, and the restricted PostgreSQL runtime role. Redacted evidence is written to `/tmp/error-tracking-native-evidence.txt`.

Inspect the retained UI with an explicit local context:

```sh
kubectl --kubeconfig .local-kubeconfig \
  --context kind-error-tracking-native -n error-tracking \
  port-forward service/grafana-11 3000:3000
```

Then open `http://localhost:3000/a/grafana-errortracking-app`.

Run the same images through sequential disposable cell and BYOC-like clusters after the base proof:

```sh
deploy/local-k8s/prove-native-multienv.sh
```

That proof compares image and binary identities, requires unique runtime credentials and generated trust material, verifies PostgreSQL network and data isolation, keeps the base cluster readable and writable while the secondary API is down, and checks secondary persistence after a PostgreSQL restart. It deletes only the disposable clusters, networks, and fixture volumes it creates. Evidence is written beneath `/tmp/error-tracking-native-multienv`.

`run-migration.sh`, `prepare-runtime-secret.sh`, `rotate-runtime-secret.sh`, and `prove-privileges.sh` are the focused building blocks. Every Kubernetes command uses an explicit kubeconfig, an explicit `kind-error-tracking-native*` context, and the `error-tracking` namespace.

These workflows validate local behavior and configuration. The checked-in issuer is a development fixture for the public signed-identity protocol. The direct TLS assertion does not prove Grafana's current aggregation transport verifies the remote certificate; that platform transport still skips verification. The workflows do not deploy remote infrastructure or prove cloud IAM, placement, or networking.
