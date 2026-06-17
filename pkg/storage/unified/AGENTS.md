# AGENTS.md — Unified Storage

Unified storage/search runs in-process (default), as a standalone storage server (`unified-grpc`), or as distributed search servers. When run separately, those servers deploy independently from the Grafana API layer at different cadences — the same commit can be live on one side and not the other.

## Client/server split

- **Client side** (runs in Grafana): `apistore/`, `federated/`, `client.go`/`client_retry.go`, and callers such as `pkg/registry/apis/`, `pkg/services/{apiserver,dashboards,folder,search,stats}/`, `pkg/services/team/search/`, `pkg/infra/leaderelection/kvlease/`, `pkg/storage/legacysql/`.
- **Server side** (may deploy separately): `resource/`, `sql/`, `search/`, `migrations/`, `parquet/`.
- **Contract** (used by both sides): `proto/`, `resourcepb/`.

## Compatibility rules

Any mix of versions must work during rollout: new client ↔ old server and old client ↔ new server.

1. **Don't move responsibility between client and server in one PR.** Ship server-side support first; switch client behavior in a follow-up after the server change is released.
2. **Contract changes must be additive.** Never remove or repurpose fields or RPCs in `proto/`/`resourcepb/` that a deployed version still uses.
3. **New client expectations need a fallback.** Keep handling old server behavior until the server change is fully rolled out.

The CI check `pr-unified-storage-compatibility.yml` fails PRs changing both sides; if truly inseparable, add the `no-check-unified-storage-compatibility` label and justify it in the PR description. The check covers common callers, not every importer, and contract-only PRs don't fire it (rule 2 is the safeguard there) — the rules apply regardless.
