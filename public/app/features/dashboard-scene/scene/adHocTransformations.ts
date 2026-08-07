import { applyFieldOverrides, type PanelData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getPanelPluginMetasMapSync, type PanelPluginMetas } from '@grafana/runtime/internal';
import { SceneDataTransformer, sceneGraph, VizPanel } from '@grafana/scenes';
import { type DataTransformerConfig } from '@grafana/schema';
import { type PanelContext } from '@grafana/ui';

/**
 * getPanelPluginMetasMapSync throws when the plugin meta cache has not been initialised yet,
 * which happens in tests and during early app boot. Treat that as "no panel opts in".
 */
function safePanelMetas(): PanelPluginMetas {
  try {
    return getPanelPluginMetasMapSync();
  } catch {
    return {};
  }
}

/**
 * Whether the panel plugin owns the transformation pipeline, in which case the host stops
 * executing it and hands the panel untransformed data.
 */
export function panelSkipsTransformationPipeline(
  pluginId: string | undefined,
  panelMetas: PanelPluginMetas = safePanelMetas()
): boolean {
  if (!config.featureToggles.panelAdHocTransformations || !pluginId) {
    return false;
  }

  const meta = panelMetas[pluginId];

  // skipDataQuery panels never get a data provider at all, so opting them in is meaningless.
  return Boolean(meta?.adHocTransforms && !meta.skipDataQuery);
}

/**
 * Keeps `skipTransformations` in sync with the parent panel's plugin, so switching the
 * visualization type hands the pipeline back and forth without any call site having to remember.
 * There are several `changePluginType` call sites and only one of them handles the analogous
 * `skipDataQuery` transition today.
 */
export function syncSkipTransformationsBehavior(transformer: SceneDataTransformer) {
  const panel = transformer.parent;

  if (!(panel instanceof VizPanel)) {
    return;
  }

  const sync = (pluginId: string) => {
    const skipTransformations = panelSkipsTransformationPipeline(pluginId);

    if (skipTransformations !== Boolean(transformer.state.skipTransformations)) {
      // SceneDataTransformer re-runs transform() itself when this flag flips.
      transformer.setState({ skipTransformations });
    }
  };

  sync(panel.state.pluginId);

  const sub = panel.subscribeToState((newState, prevState) => {
    if (newState.pluginId !== prevState.pluginId) {
      sync(newState.pluginId);
    }
  });

  return () => sub.unsubscribe();
}

/**
 * Stamps a transformation the user added in the transformations editor. Gated on the feature
 * toggle so dashboard JSON is untouched while the feature is off — an absent origin already means
 * "editor", so nothing is lost by not writing it.
 */
export function withEditorOrigin(transformation: DataTransformerConfig): DataTransformerConfig {
  if (!config.featureToggles.panelAdHocTransformations || transformation.origin) {
    return transformation;
  }

  return { ...transformation, origin: { source: 'editor' } };
}

const EMPTY_TRANSFORMATIONS: DataTransformerConfig[] = [];

/** Matches `$var`, `${var}` and `[[var]]`. */
const VARIABLE_PATTERN = /\$|\[\[/;

function getDataTransformer(vizPanel: VizPanel): SceneDataTransformer | undefined {
  const provider = vizPanel.state.$data;
  return provider instanceof SceneDataTransformer ? provider : undefined;
}

/**
 * Adds the transformation members to a panel context. Panels that own their pipeline read and
 * write it through these; everything else ignores them.
 *
 * All members are functions rather than values because VizPanel memoizes the context object
 * after the first `getPanelContext()` call, so a snapshot value would go stale. Re-rendering is
 * already handled for us: VizPanelRenderer subscribes to the whole SceneDataTransformer state,
 * so mutating `transformations` re-renders the panel and these getters are called again.
 */
export function setAdHocTransformationsPanelContext(vizPanel: VizPanel, context: PanelContext) {
  let cachedJson: string | undefined;
  let cachedConfigs: DataTransformerConfig[] = EMPTY_TRANSFORMATIONS;

  context.isAdHocTransformsEnabled = () => panelSkipsTransformationPipeline(vizPanel.state.pluginId);

  context.getTransformations = () => {
    const transformer = getDataTransformer(vizPanel);

    if (!transformer) {
      return EMPTY_TRANSFORMATIONS;
    }

    // Custom transform operators are functions. They only exist in code-built scenes, can't be
    // interpolated and can't be persisted, so a panel should never see them.
    const raw = transformer.state.transformations.filter(
      (t): t is DataTransformerConfig => typeof t === 'object' && t !== null && 'id' in t
    );

    if (raw.length === 0) {
      return EMPTY_TRANSFORMATIONS;
    }

    const json = JSON.stringify(raw);

    // Keep a stable array identity so callers can use the result as a hook dependency.
    if (json === cachedJson) {
      return cachedConfigs;
    }

    cachedJson = json;
    cachedConfigs = VARIABLE_PATTERN.test(json)
      ? // Mirrors SceneDataTransformer's own interpolation, including the request scoped vars
        // that carry repeat-by-row values. Panels must not interpolate with replaceVariables,
        // which does not see those.
        JSON.parse(sceneGraph.interpolate(transformer, json, transformer.state.data?.request?.scopedVars))
      : raw;

    return cachedConfigs;
  };

  context.setTransformations = (configs: DataTransformerConfig[]) => {
    const transformer = getDataTransformer(vizPanel);

    if (!transformer) {
      return;
    }

    transformer.setState({ transformations: configs });
    // Required when the pipeline is not bypassed: the source frames are reference-equal so the
    // transformer would otherwise short-circuit.
    transformer.reprocessTransformations();
  };

  let cachedSourceData: PanelData | undefined;
  let cachedSeriesLimit: number | undefined;
  let cachedLimitedData: PanelData | undefined;

  context.getUntransformedData = () => {
    const transformer = getDataTransformer(vizPanel);
    const data = transformer ? (transformer.state.$data?.state.data ?? transformer.state.data) : undefined;

    if (!data) {
      return undefined;
    }

    const { seriesLimit, seriesLimitShowAll } = vizPanel.state;

    if (!seriesLimit || seriesLimitShowAll) {
      return data;
    }

    // Parity with the series limit VizPanelRenderer applies before handing data to the panel.
    // The slice has to be cached: callers use `series` as a hook dependency, so handing back a
    // fresh array on every call would re-trigger their effects indefinitely.
    if (!cachedLimitedData || cachedSourceData !== data || cachedSeriesLimit !== seriesLimit) {
      cachedSourceData = data;
      cachedSeriesLimit = seriesLimit;
      cachedLimitedData = { ...data, series: data.series.slice(0, seriesLimit) };
    }

    return cachedLimitedData;
  };

  context.applyFieldConfig = (data: PanelData): PanelData => {
    const plugin = vizPanel.getPlugin();

    if (!plugin || plugin.meta.skipDataQuery) {
      return data;
    }

    const dataSupport = plugin.dataSupport ?? { alertStates: false, annotations: false };
    const shared = {
      fieldConfigRegistry: plugin.fieldConfigRegistry,
      replaceVariables: vizPanel.interpolate,
      theme: config.theme2,
      timeZone: data.request?.timezone,
    };

    const result: PanelData = {
      ...data,
      series: applyFieldOverrides({ ...shared, data: data.series, fieldConfig: vizPanel.state.fieldConfig }),
    };

    if (result.annotations) {
      result.annotations = applyFieldOverrides({
        ...shared,
        data: result.annotations,
        fieldConfig: { defaults: {}, overrides: [] },
      });
    }

    if (!dataSupport.alertStates) {
      result.alertState = undefined;
    }

    if (!dataSupport.annotations) {
      result.annotations = undefined;
    }

    return result;
  };
}
