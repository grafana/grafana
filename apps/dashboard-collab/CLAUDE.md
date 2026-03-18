# Dashboard Collaboration App (dashboard-collab)

## What This Is

Real-time collaborative dashboard editing for Grafana. Multiple users edit a single dashboard simultaneously with live cursors, panel-level locking, and automatic saving.

**Status**: POC — experimental, behind feature flag `dashboardCollaboration`.
**Requires**: Dashboard API v2beta1 or later. v1 dashboards are NOT supported.

## Architecture Decisions (Do Not Deviate)

1. **Server-authoritative**: All operations flow through the Collab Service, which assigns a global sequence number. No client-side optimistic apply, no OT, no CRDTs.
2. **Panel-level soft locks**: Users acquire a lock when editing a panel. Others cannot edit a locked panel. Locks release on blur, close, or disconnect.
3. **Operations use DashboardMutationAPI vocabulary**: The collab wire format wraps `MutationRequest` (from `@grafana/data`). The backend is payload-agnostic; it sequences and broadcasts without inspecting mutation payloads.
4. **Two-sided integration**:
   - **Extraction (local → server)**: `opExtractor` hooks into `SceneObjectStateChangedEvent`, produces `MutationRequest` objects matching the MutationAPI command vocabulary, sends to server. This is temporary — post-POC, UI edits will route through `DashboardMutationClient.execute()` directly, eliminating the extractor.
   - **Application (server → local)**: `opApplicator` receives remote ops and applies them by calling `DashboardMutationClient.execute()`. This side is clean and permanent.
5. **Operations on commit/blur**: Ops are sent when a field change is committed (blur, Enter, close editor), not per-keystroke.
6. **Split Centrifuge channels**: `collab/{namespace}/{uid}/ops` (server-mediated) and `collab/{namespace}/{uid}/cursors` (client-direct broadcast, ephemeral).
7. **Tiered version history**: Autosaves create `version_type='auto'`, manual Cmd+S creates `version_type='manual'`.
8. **Cursor data is ephemeral**: Never persisted. Flows through Centrifuge pub/sub only.
9. **In-memory state for POC**: Sessions, locks, and ops buffer are in-memory. No Redis dependency yet.
10. **v2beta1+ only**: Collaboration requires dashboard API v2beta1 or later. v1 dashboards are excluded at the gating check.

## Worktree

All work happens in the `feat/dashboard-collaboration` branch, checked out at `/Users/dominik/Projects/worktrees/dashboard-collab/`. Do NOT modify the main worktree at `/Users/dominik/Projects/grafana/`.

## Key Patterns to Follow

### Backend (Go)

- Follow existing patterns in `apps/example/` for app structure.
- Channel handlers go in `pkg/services/live/features/` and implement `model.ChannelHandlerFactory`.
- Feature flags: edit `pkg/services/featuremgmt/registry.go`, then run `make gen-feature-toggles`.
- Use Wire DI for service wiring. Run `make gen-go` after changing service init.
- The backend is **payload-agnostic** — it sequences `CollabOperation` messages by checking `lockTarget` but NEVER inspects `mutation.type` or `mutation.payload`.
- Tests: `go test -race ./apps/dashboard-collab/...`

### Frontend (TypeScript/React)

- New code lives in `public/app/features/dashboard-collab/`.
- Function components with hooks. Styling via `useStyles2` (Emotion CSS-in-JS).
- Use `@grafana/runtime` for accessing Grafana Live (`getGrafanaLiveSrv()`).
- Reuse the existing `DashboardMutationAPI` commands. See `public/app/features/dashboard-scene/mutation-api/commands/registry.ts` for all 22 commands.
- Tests: `yarn jest --no-watch public/app/features/dashboard-collab/`
- Type check: `yarn typecheck`

### Protocol Types

- Go wire format in `apps/dashboard-collab/pkg/protocol/messages.go`
- TypeScript wire format in `public/app/features/dashboard-collab/protocol/messages.ts`
- These must stay in sync. Go is source of truth.
- Frontend `CollabOperation.mutation` uses the existing `MutationRequest` type from `@grafana/data` — do NOT redefine it.

## What NOT to Do

- Do not add Redis, etcd, or external dependencies — in-memory only for POC.
- Do not define custom operation types — produce MutationRequest objects matching DashboardMutationAPI commands.
- The opExtractor (scene events → MutationRequest) is intentionally temporary. Do not over-engineer it. Post-POC, UI edits will route through DashboardMutationClient directly.
- Do not support v1/v1beta1 dashboards — v2beta1+ only.
- Do not implement character-level collaborative text editing.
- Do not modify existing save behavior for non-collab dashboards.
- Do not add undo/redo across users — local undo only.
- Do not persist cursor data.
- Do not skip tests. Every new file needs a corresponding test file.
- Do not amend commits from other steps. Each step is a separate commit.

## Gating Logic

Collaboration mode activates only when ALL of these are true:
```
featureToggles.dashboardCollaboration === true
  AND dashboard.apiVersion starts with 'dashboard.grafana.app/v2'  (v2beta1+)
  AND dashboard.metadata.annotations['grafana.app/collaboration'] === 'enabled'
  AND dashboard.metadata.annotations['grafana.app/managedBy'] is absent (not provisioned)
```

## File Layout

```
apps/dashboard-collab/
  pkg/
    app/          — App registration and wiring
    collab/       — Session manager, lock table, sequencer, autosave
    protocol/     — Wire protocol message types (Go)

public/app/features/dashboard-collab/
  protocol/       — Wire protocol message types (TypeScript, mirrors Go)
  opExtractor.ts            — Scene events → MutationRequest (temporary, see design doc)
  opApplicator.ts           — Remote ops → DashboardMutationClient.execute()
  lockTargetMapping.ts      — Maps mutation types to lock targets
  CollabProvider.tsx
  CollabContext.ts
  useCollab.ts
  CollabCursorOverlay.tsx
  CollabPanelBorder.tsx
  CollabPresenceBar.tsx
  cursor-utils.ts

public/app/features/dashboard-scene/mutation-api/commands/
  updateDashboardInfo.ts    — New command filling the MutationAPI gap

pkg/services/live/features/
  collab.go       — Grafana Live channel handler for collaboration
```

## Key DashboardMutationAPI References

| File | Purpose |
|---|---|
| `public/app/features/dashboard-scene/mutation-api/DashboardMutationClient.ts` | Client we wrap |
| `public/app/features/dashboard-scene/mutation-api/commands/registry.ts` | All 22 commands |
| `public/app/features/dashboard-scene/mutation-api/commands/schemas.ts` | Zod payload schemas |
| `public/app/features/dashboard-scene/mutation-api/commands/types.ts` | MutationCommand interface |
| `packages/grafana-data/src/context/plugins/RestrictedGrafanaApis.tsx` | Public API interface |
| `public/app/features/dashboard-scene/scene/DashboardScene.tsx:277-287` | Client lifecycle (activate/deactivate) |

## Execution Plan Reference

Full plan with step-by-step breakdown, acceptance criteria, and review gates is in the Obsidian vault at `Praca/Projects/Multiplayer/Execution Plan.md`.

## Build & Test Commands

```bash
# Backend
go test -race ./apps/dashboard-collab/...
make build-backend

# Frontend
yarn jest --no-watch public/app/features/dashboard-collab/
yarn typecheck
yarn lint public/app/features/dashboard-collab/

# Full
make run    # Backend with hot reload
yarn start  # Frontend dev server

# Codegen (after modifying feature flags or service wiring)
make gen-feature-toggles
make gen-go
```
