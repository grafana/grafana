# Dashboard build engine contract

The **Generate a dashboard** wizard in OSS core routes construction through a
pluggable "build engine". This document is the handoff for the plugin-side
implementation — the OSS side of the contract is fully implemented in
`dashboardBuildStrategy.ts`.

## Overview

```
+-------------------------------------------------------------+
|  OSS core (this repo)                                       |
|                                                             |
|  GenerateDashboardModal ──> useDashboardGenerator ──┐       |
|                                                     |       |
|                                                     v       |
|                                     chooseBuildStrategy()   |
|                                                     |       |
|            +----------------------------------------+       |
|            |                                                |
|            v (engine on + registered)                       |
|      getDashboardBuildEngine().build(brief)                 |
|            |                                                |
|            v (engine off / unavailable / throws)            |
|      local composer (runMultiAgentGeneration)               |
+-------------------------------------------------------------+
                                ^
                                | setDashboardBuildEngine(engine)
                                |
+-------------------------------------------------------------+
|  Assistant plugin (separate repo)                           |
|                                                             |
|  On bootstrap:                                              |
|    setDashboardBuildEngine({                                |
|      isAvailable: () => …,                                  |
|      build: (brief) => runDashboardingHeadless(brief),      |
|    });                                                      |
|                                                             |
|  (or lazily)                                                |
|    setDashboardBuildEngineInitializer(async () => {         |
|      const { engine } = await import('./engine');           |
|      setDashboardBuildEngine(engine);                       |
|    });                                                      |
+-------------------------------------------------------------+
```

## Types

Exported from `dashboardBuildStrategy.ts`. The `@grafana/assistant` package
must re-export them so the plugin can consume them without depending on
`grafana/grafana` directly.

- `DashboardBuildBrief` — everything the OSS wizard collected: chosen
  intents (with pivot dimensions), primary + additional datasources,
  `DatasourceAnalysis` (labels, samples, capabilities, Loki `logs` signals if
  applicable), `CustomizationOptions`, and `IntentGenerationContext`
  (`mode` beginner|expert, `orientation` technical|business|both, `refinement`).
- `DashboardBuildResult` — `spec: DashboardV2Spec`, optional
  `recipe: DashboardRecipe` (composer only), `source: 'engine' | 'composer'`.
- `DashboardBuildEngine` — `{ isAvailable(): boolean; build(brief): Promise<DashboardBuildResult> }`.
- `DashboardBuildEngineInitializer` — `() => Promise<void>` for lazy loading.

## Registration API

- `setDashboardBuildEngine(engine | null)` — Plugin calls this once with a
  concrete implementation. Passing `null` unregisters (tests / hot-reload).
- `getDashboardBuildEngine()` — OSS reads this. Returns `null` when nothing is
  registered.
- `setDashboardBuildEngineInitializer(fn | null)` — Plugin optionally
  registers a lazy initializer. Idempotent; wraps a cached promise.
- `ensureDashboardBuildEngineInitialized()` — OSS calls this before every
  build. Runs the initializer once, absorbs errors so the strategy picker can
  fall back to the composer.

State is stored on `globalThis` under `__grafanaDashboardBuildEngine__` so OSS
and the plugin can each bring their own copy of `@grafana/assistant` into the
browser and still share a single engine slot (same trick the InlineAssistant
factory uses).

## Feature toggle

`assistantDashboardBuildEngine` (declared in `pkg/services/featuremgmt/registry.go`).
Off by default. When on **and** an engine is registered **and** the engine's
`isAvailable()` returns true, `chooseBuildStrategy` prefers the engine and
falls back to the composer only if the engine's `build` throws.

## Plugin-side responsibilities

1. Add exports to `@grafana/assistant` (a separate package in
   `grafana-assistant-app/packages/@grafana/assistant`) that re-export the types
   and setter/getter listed above, so the plugin doesn't depend on
   `grafana/grafana` internals.
2. Implement a `DashboardBuildEngine` that runs the plugin's existing
   `dashboardingMode` toolchain headlessly (no sidebar):
   - Feed the brief's `selections` + `analysis` + `context` into the
     agent as it currently does when opened via
     `openAssistant({ mode: 'dashboarding' })`, but without opening the
     sidebar UI — the entry point should be a pure function that returns the
     final V2 spec produced by the existing `features/dashboarding/v2Api.ts`.
   - Honour `context.refinement` as the primary user intent.
   - Honour `context.mode` (beginner vs expert) and `context.orientation`
     (technical / business / both) when choosing panel density and audience
     framing.
   - Handle Loki (`analysis.capabilities.logs`) alongside metrics.
3. Register the engine on plugin bootstrap via
   `setDashboardBuildEngine(engine)` (or the lazy initializer variant).
4. Publish `@grafana/assistant` with the new exports so OSS can bump its
   dependency and start consuming the re-exports directly.

Until step 4 ships, plugins can still register an engine by importing the
setter from `@grafana/grafana`'s in-repo module path — but the shipping
integration point is `@grafana/assistant`.

## Rollout plan

1. **Phase A (this repo, ships independently, ✅)**: analysis + Loki
   support, data-driven categories/intents, modes/refinement/orientation,
   enriched composer, this seam using the composer as the sole path.
2. **Phase B (plugin + `@grafana/assistant`, separate repo)**: implement the
   engine, publish `@grafana/assistant` with the re-exports.
3. **Phase C (this repo, one-liner)**: enable the feature toggle in
   `conf/defaults.ini` (or via a Grafana Cloud config change) once the
   plugin's engine ships and is stable.
