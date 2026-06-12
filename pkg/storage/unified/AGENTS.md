# AGENTS.md — Unified Storage

Guidance for AI agents working under `pkg/storage/unified/`.

## What lives here

| Directory     | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `resource/`   | Core resource server (gRPC endpoints, storage backend interface, watch/events) |
| `sql/`        | SQL storage backend and resource version management                            |
| `search/`     | Bleve-based search indexing and search server                                  |
| `apistore/`   | Kubernetes-style storage adapter — runs inside the Grafana API server process  |
| `proto/`      | Protocol buffer definitions (gRPC contract)                                    |
| `resourcepb/` | Generated protobuf Go code                                                     |
| `federated/`  | Federation client for reading across legacy and unified storage                |
| `migrations/` | Data migration from legacy SQL to unified storage                              |
| `parquet/`    | Parquet support for bulk import/export                                         |

## Deployment modes

Unified storage runs in several modes:

- **In-process** (default): storage and search run inside the main Grafana process.
- **Separate storage server** (`unified-grpc`): Grafana connects to a standalone storage server over gRPC.
- **Distributed search**: standalone search servers behind a distributor, sharded by namespace.

When run as separate services, the storage/search servers are deployed independently from the Grafana API layer, potentially at different cadences. The same commit can therefore be live on one side and not the other.

## Compatibility rules

Because of independent deployment, **any mix of versions must work during rollout**: a new API layer with an old storage/search server, and an old API layer with a new storage/search server.

- **Client side** (runs in Grafana): `apistore/`, `federated/`, the root client files (`client.go`, `client_retry.go`), and callers such as `pkg/registry/apis/`, `pkg/services/{apiserver,dashboards,folder,search,stats}/`, `pkg/services/team/search/`, `pkg/infra/leaderelection/kvlease/`, `pkg/storage/legacysql/`.
- **Server side** (may be deployed separately): `resource/`, `sql/`, `search/`, `migrations/`, `parquet/`.
- **Contract** (used by both sides): `proto/`, `resourcepb/` — governed by rule 2 below.

Rules:

1. **Don't move responsibility between client and server in a single PR.** Ship server-side support first; switch client behavior in a follow-up after the server change is released. Each PR must work on its own against the other side's old version.
2. **Proto/contract changes must be additive.** Never remove or repurpose fields or RPCs in `proto/`/`resourcepb/` that a deployed version still uses.
3. **Behavior changes need a fallback.** If the client starts relying on new server behavior (e.g. new query semantics), keep handling the old behavior until the server change is fully rolled out.

The CI check `pr-unified-storage-compatibility.yml` fails PRs that change both sides. If changes truly cannot be separated, add the `no-check-unified-storage-compatibility` label and justify it in the PR description. The check covers common client-side callers, not every importer, and contract-only PRs (`proto/`, `resourcepb/`) don't fire it — rule 2 is the only safeguard there. The rules above apply regardless of whether the check fires.
