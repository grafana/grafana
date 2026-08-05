# Cleanup: Unify the core Wire sets and remove the OSS register/dispatch shim

| Field | Value |
|-------|-------|
| **Repo** | `grafana/grafana` (OSS) |
| **Depends on** | Step 04 |
| **Relates to** | Steps 07–08, 13 (GE wire ownership) |
| **Behavior change** | None (pure refactor + Wire regen) |

## Goal

Remove two workarounds that exist for the **same** import cycle:

1. the OSS **register/dispatch shim** — `pkg/server/bootstrap/wire/register_oss.go`
   (pushes injectors into `pkg/server` via `init()`) and
   `pkg/server/initialize_oss.go` (thin `server.Initialize` shims over the
   registered vars); and
2. the enterprise **duplicate of the core sets** — `pkg/server/wire_core.go`,
   a near-verbatim copy of `pkg/server/bootstrap/wire/sets.go`.

End state: a single edition-neutral sets package (`bootstrap/wire`) imported by
OSS, Enterprise, and GE; each edition's injectors live in its own build-tagged
location; no dispatch indirection, no duplicated sets, no blank-import requirement.

## Background — the root cause

`bootstrap/wire/sets.go` references constructors that live in `pkg/server`:

```
pkg/server/bootstrap/wire/sets.go:204   server.New      (Server set)
pkg/server/bootstrap/wire/sets.go:493   server.NewRunner (CLI set)
```

So **`bootstrap/wire` imports `pkg/server`**. That forbids the reverse edge:
`pkg/server` cannot import `bootstrap/wire` to call the generated OSS
`Initialize` — it would be an import cycle. Each edition works around this
differently:

| Edition | Workaround | Cost |
|---|---|---|
| OSS | injectors live in `bootstrap/wire`; `register_oss.go`'s `init()` pushes them into `pkg/server` vars; `initialize_oss.go` shims `server.Initialize` over the vars | roundabout dispatch; every entrypoint must blank-import `bootstrap/wire` |
| Enterprise | keeps its own copy of the core sets **inside** `pkg/server` (`wire_core.go`), so its injector (`wire.go`) never imports `bootstrap/wire` | ~530 lines of duplicated sets, manually kept in sync |

Both disappear if `bootstrap/wire` stops importing `pkg/server`.

## Approach

**Break the cycle by relocating the constructors the sets reference.**

1. Move `server.New`, `server.NewRunner`, `server.NewModule`,
   `server.NewModuleRunner` (and any other constructors referenced by the sets)
   out of `pkg/server` into a **leaf package** that does not import the rest of
   `pkg/server` — e.g. `pkg/server/serverinit` (name TBD). Keep the `Server` /
   `ModuleServer` / `Runner` *types* wherever is cleanest; only the constructor
   functions the sets call must leave the import path that creates the cycle.
2. Point `bootstrap/wire/sets.go` at the new package. `bootstrap/wire` now
   imports only leaf packages — **no longer `pkg/server`**.
3. Move the OSS injectors + generated graph into `pkg/server`, `oss`-tagged,
   **symmetric with enterprise**:
   - `pkg/server` (oss) defines `Initialize`, `InitializeForTest`,
     `InitializeForCLI`, `InitializeAPIServerFactory`, `InitializeModuleServer`
     by `wire.Build(bootstrapwire.Server, wireext.Set)` — importing
     `bootstrap/wire` for the sets is now legal (no cycle).
   - Delete `pkg/server/bootstrap/wire/inject.go`, `oss_ext.go`,
     `register_oss.go`, `wire_gen.go` (the OSS injector/graph); `bootstrap/wire`
     becomes **sets-only** (`sets.go` + `doc.go`).
   - Delete `pkg/server/initialize_oss.go` (the dispatch shim) — `server.Initialize`
     is now a normal generated function under the `oss` tag.
4. Delete the enterprise duplicate `pkg/server/wire_core.go`; the enterprise
   injector (`wire.go` / overlaid `wireexts_enterprise.go`, later the GE module)
   imports `bootstrap/wire` for the sets like everyone else.
5. Regenerate both graphs (`make gen-go` OSS + enterprise) and update
   `//go:build` tags accordingly.

After this, `main` no longer needs the `_ "pkg/server/bootstrap/wire"` blank
import — `server.Initialize` is a direct symbol again. (`main` may then import
`bootstrap/wire.Initialize` directly, but `server.Initialize` is fine too.)

## Scope

### In scope

- Relocate the constructor functions the sets reference into a leaf package.
- Make `bootstrap/wire` sets-only; move OSS injectors into `pkg/server` (oss tag).
- Delete `register_oss.go`, `initialize_oss.go`, `wire_core.go`.
- Regenerate OSS + enterprise Wire.
- Remove now-unnecessary `_ "pkg/server/bootstrap/wire"` blank imports.

### Out of scope

- Moving enterprise Wire into the GE module (that is Steps 07–08/13; this change
  makes those simpler by giving them one sets package to import).
- Provider/binding changes — no graph content changes, only where sets/injectors live.

## Risks / watch-outs

- **Constructor relocation ripples.** `server.New` etc. are referenced by tests
  and possibly other callers, not just the sets. Grep every caller and update
  imports. Keep the move mechanical.
- **Two graphs regenerate.** Diff both `wire_gen.go` outputs to confirm no
  provider order/binding changes — only import-path/package differences.
- **Enterprise overlay must stay green** through the transition (`wire_core.go`
  deletion + enterprise injector repoint). Coordinate with the overlay sync.
- **`IsEnterprise` load point** is unaffected (handled by Step 04 — injected from
  `main`), but re-verify after the blank imports are removed.

## Acceptance criteria

- [ ] `bootstrap/wire` contains only `sets.go` + `doc.go`; grep shows it does not
      import `pkg/server`.
- [ ] `register_oss.go`, `initialize_oss.go`, `wire_core.go` deleted.
- [ ] `server.Initialize` is a direct generated symbol under both `oss` and
      `enterprise` tags; no `RegisterInitializers` dispatch.
- [ ] OSS build + `-tags=enterprise` build both pass; Wire regen shows no graph
      content change.
- [ ] `make run-go` starts Grafana; `/api/health` 200 in both editions.
- [ ] All prior-step verification commands pass.

## Notes

This is an OSS-internal cleanup with no behavior change. It is worth doing before
or alongside the GE wire-ownership steps (07–08, 13), because it collapses the
"OSS uses `bootstrap/wire` sets, enterprise uses `wire_core.go` copy" split into a
single sets package that GE's own injector imports the same way — which is
exactly the shape those steps assume.
