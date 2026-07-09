import { type DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DashboardRecipe } from './recipe';
import {
  type CustomizationOptions,
  type DatasourceAnalysis,
  type IntentGenerationContext,
  type IntentSelection,
} from './types';

/**
 * Everything the OSS wizard produces before construction hands off — the LLM's
 * chosen intents, the datasource context, the user's inputs. Consumed by both
 * the headless engine path (Assistant plugin) and the local composer fallback
 * (this repo). Kept identical to the current in-repo request payload so callers
 * don't need to shape data twice.
 *
 * @public This is part of the OSS ↔ Assistant-plugin contract. Any change to
 * this shape must be coordinated with the plugin (`@grafana/assistant`
 * re-exports these types) and rolled out backwards-compatibly.
 */
export interface DashboardBuildBrief {
  selections: IntentSelection[];
  primaryDatasource: DataSourceInstanceSettings;
  additionalDatasources: DataSourceInstanceSettings[];
  analysis: DatasourceAnalysis;
  customization: CustomizationOptions;
  context: IntentGenerationContext;
}

/**
 * The build output — a V2 dashboard spec plus (optionally) the recipe the
 * composer produced along the way, useful for debugging and telemetry.
 * `source` distinguishes engine builds from composer builds; the modal reports
 * it as a telemetry dimension so we can compare quality.
 *
 * @public Part of the OSS ↔ Assistant-plugin contract.
 */
export interface DashboardBuildResult {
  spec: DashboardV2Spec;
  recipe?: DashboardRecipe;
  source: 'engine' | 'composer';
}

/**
 * Contract a headless "dashboard build engine" implements. The Grafana Assistant
 * plugin registers an implementation of this at runtime (via
 * `setDashboardBuildEngine`, re-exported through `@grafana/assistant`); OSS code
 * only consumes the interface.
 *
 * Engines run the full dashboarding-mode toolchain (search templates, propose
 * panels, add variables, layout tabs/rows) and return the final V2 spec —
 * *without* opening the Assistant sidebar. That's the key difference from the
 * current `openAssistant({ mode: 'dashboarding' })` entry point.
 *
 * @public Part of the OSS ↔ Assistant-plugin contract.
 */
export interface DashboardBuildEngine {
  /**
   * Best-effort probe indicating the engine is ready to run. Called before the
   * strategy picker commits to the engine path so a partially-initialised plugin
   * can still fall back to the composer instead of surfacing an error to the
   * user.
   */
  isAvailable(): boolean;
  /**
   * Runs the engine build. Should reject on unrecoverable errors (missing
   * datasource, LLM outage, unauthorised) so the strategy picker can degrade
   * gracefully.
   */
  build(brief: DashboardBuildBrief): Promise<DashboardBuildResult>;
}

/**
 * A lazy initializer the plugin can register so the engine implementation is
 * only loaded on first use, mirroring the InlineAssistant initializer pattern
 * used elsewhere in `@grafana/assistant`. Called at most once per bundle.
 *
 * @public Part of the OSS ↔ Assistant-plugin contract.
 */
export type DashboardBuildEngineInitializer = () => Promise<void>;

interface DashboardBuildEngineStorage {
  engine: DashboardBuildEngine | null;
  initializer: DashboardBuildEngineInitializer | null;
  initPromise: Promise<void> | null;
}

/**
 * Global-storage slot used to share engine state across bundles. We route
 * state through `globalThis` (not a module-level variable) for the same reason
 * the InlineAssistant factory does: OSS and the Assistant plugin can each
 * bring their own copy of `@grafana/assistant` into the browser and would
 * otherwise register into separate module instances. Using `globalThis`
 * guarantees any caller of the OSS setter and any caller of the
 * `@grafana/assistant`-re-exported setter (once the plugin ships) meet in the
 * same slot.
 */
declare global {
  // eslint-disable-next-line no-var
  var __grafanaDashboardBuildEngine__: DashboardBuildEngineStorage | undefined;
}

function getStorage(): DashboardBuildEngineStorage {
  const existing = globalThis.__grafanaDashboardBuildEngine__;
  if (existing) {
    return existing;
  }
  const created: DashboardBuildEngineStorage = { engine: null, initializer: null, initPromise: null };
  globalThis.__grafanaDashboardBuildEngine__ = created;
  return created;
}

/**
 * Registers a dashboard-build engine implementation. Called once by the
 * Assistant plugin on bootstrap. Passing `null` unregisters (useful for tests
 * and hot-reload).
 *
 * @public Part of the OSS ↔ Assistant-plugin contract.
 */
export function setDashboardBuildEngine(engine: DashboardBuildEngine | null): void {
  getStorage().engine = engine;
}

/**
 * Returns the currently-registered engine, or `null` when nothing is wired up
 * yet. `ensureDashboardBuildEngineInitialized` should be awaited before calling
 * this so any lazy initializer registered by the plugin has a chance to run.
 *
 * @public Part of the OSS ↔ Assistant-plugin contract.
 */
export function getDashboardBuildEngine(): DashboardBuildEngine | null {
  return getStorage().engine;
}

/**
 * Registers a lazy initializer the plugin can call from its bootstrap to defer
 * loading the engine implementation (which is heavy — it drags in tool
 * definitions, prompt templates and datasource clients) until the first build
 * request. Ideal for plugins that would otherwise inflate initial-load bundles.
 *
 * @public Part of the OSS ↔ Assistant-plugin contract.
 */
export function setDashboardBuildEngineInitializer(fn: DashboardBuildEngineInitializer | null): void {
  const storage = getStorage();
  storage.initializer = fn;
  storage.initPromise = null;
}

/**
 * Ensures any registered initializer has run. Idempotent — the promise is
 * cached so concurrent build requests share a single init call. Silently
 * absorbs initializer errors so the strategy picker can degrade to the
 * composer instead of surfacing an internal failure to the user.
 *
 * @public Part of the OSS ↔ Assistant-plugin contract.
 */
export async function ensureDashboardBuildEngineInitialized(): Promise<void> {
  const storage = getStorage();
  if (storage.engine) {
    return;
  }
  if (!storage.initializer) {
    return;
  }
  if (!storage.initPromise) {
    storage.initPromise = storage.initializer().catch(() => {
      // Reset so the initializer can be retried on the next build attempt,
      // rather than being permanently poisoned by a transient failure.
      storage.initPromise = null;
    });
  }
  await storage.initPromise;
}

/**
 * Feature-toggle gating the headless engine path. Wired through
 * `pkg/services/featuremgmt` — off by default so the OSS wizard uses the
 * composer until the plugin API is stable and the feature is opted into.
 */
function isEngineFeatureEnabled(): boolean {
  return config.featureToggles.assistantDashboardBuildEngine === true;
}

/**
 * The strategy the wizard should use for the current environment.
 *
 * `source` reflects the *chosen* strategy so telemetry emitted at the point of
 * picking (before we know if the engine will fall back mid-build) still
 * reports the intended path.
 */
export interface BuildStrategy {
  build: (brief: DashboardBuildBrief) => Promise<DashboardBuildResult>;
  source: 'engine' | 'composer';
}

/**
 * Resolves the build strategy for the current environment. Prefers the
 * registered engine when both the feature toggle is on and the engine reports
 * itself available; otherwise returns a wrapper around `composerBuild` that
 * flags every result as coming from the composer.
 *
 * The composer path is provided by the caller (rather than imported here) so
 * this seam stays independent of `generateDashboard.ts` — the composer needs
 * hooks (React refs, in-flight cancellation), and the strategy picker is a
 * plain function called from inside the composer's own request lifecycle.
 */
export function chooseBuildStrategy(
  composerBuild: (brief: DashboardBuildBrief) => Promise<DashboardBuildResult>
): BuildStrategy {
  const engine = getDashboardBuildEngine();
  if (engine && isEngineFeatureEnabled() && engine.isAvailable()) {
    return {
      source: 'engine',
      build: async (brief) => {
        try {
          const result = await engine.build(brief);
          return { ...result, source: 'engine' };
        } catch {
          // Engine bombed — degrade to the composer rather than propagate a
          // failure that would be a purely internal detail (missing plugin
          // permissions, transient outage) surfacing as a wizard error.
          const fallback = await composerBuild(brief);
          return { ...fallback, source: 'composer' };
        }
      },
    };
  }
  return {
    source: 'composer',
    build: async (brief) => {
      const result = await composerBuild(brief);
      return { ...result, source: 'composer' };
    },
  };
}
