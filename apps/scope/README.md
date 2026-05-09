# Updating OpenAPI spec

Change the desired types, then run these commands, with the linked Enterprise repo:

```
go test --tags "pro" -timeout 30s -run ^TestIntegrationOpenAPIs$ github.com/grafana/grafana/pkg/extensions/apiserver/tests -count=1
```

```
./hack/update-codegen.sh scope
```

This should generate a diff in the Enterprise repo. Make sure to open a PR there too.

## OSS vs Enterprise split

The scope API is split across two repos:

**OSS (`apps/scope/pkg/apis/scope/v0alpha1/`)**

- `types.go` — canonical Go types
- `zz_generated.openapi.go` — generated OpenAPI schema functions (run `./hack/update-codegen.sh scope` to regenerate)

**Enterprise (`pkg/extensions/apiserver/registry/scope/`)**

- `register.go` — API server registration and `PostProcessOpenAPI()` (path rewrites, parameter overrides)
- - OpenAPI JSON snapshot — produced by running a real Enterprise server, so it can't live in OSS

**OSS (`public/app/api/clients/scope/v0alpha1/`)**

- `endpoints.gen.ts` — RTK Query client, generated from the OpenAPI spec and synced from Enterprise

## Query-parameter-only types

The k8s API machinery only auto-generates OpenAPI schemas for types that appear as **response bodies**
(i.e. `runtime.Object`s returned from `New()` or `ProducesObject()`). Types used only as query
parameters — currently `ScopeNavigationOptions` (`depth`, `rootScope`) — are invisible to this
machinery and must be wired manually.

When adding or changing fields on a query-parameter-only type:

1. Open `pkg/extensions/apiserver/registry/scope/register.go` in the Enterprise repo.
2. Find the `PostProcessOpenAPI()` function and locate the relevant endpoint's `Parameters` slice.
3. Add or update the parameter entry by hand.
4. Regenerate and verify the snapshot (see commands above).

## Updating the RTK Query client

The TypeScript client at `public/app/api/clients/scope/v0alpha1/endpoints.gen.ts` is generated
from the OpenAPI spec and synced from Enterprise. After updating the spec, regenerate it:

```bash
  ./public/app/api/clients/scope/v0alpha1/sync-from-enterprise.sh
```

This script requires the OpenAPI spec to already exist at data/openapi/scope.grafana.app-v0alpha1.json.
If it doesn't (e.g. after a fresh clone), generate it first by running the integration test:

```bash
  go test --tags "pro" -timeout 5m \
    -run ^TestIntegrationOpenAPIs$ \
    github.com/grafana/grafana/pkg/extensions/apiserver/tests \
    -count=1
```
