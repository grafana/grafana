import { useEffect, useMemo, useRef } from 'react';

import {
  compareArrayValues,
  compareDataFrameStructures,
  EventBusSrv,
  getPanelOptionsWithDefaults,
  PluginContextProvider,
  useFieldOverrides,
  type AbsoluteTimeRange,
  type DataFrame,
  type FieldConfigSource,
  type GrafanaTheme2,
  type PanelData,
} from '@grafana/data';
import { DashboardCursorSync } from '@grafana/schema';
import {
  ErrorBoundaryAlert,
  PanelContextProvider,
  useTheme2,
  type PanelContext,
  type SeriesVisibilityChangeMode,
} from '@grafana/ui';
import { seriesVisibilityConfigFactory } from 'app/features/dashboard/dashgrid/SeriesVisibilityConfigFactory';

// Imported by path, not through '@grafana/runtime': vite aliases that specifier at
// build time, but typechecking should see the real runtime types everywhere else.
import { getPanelPlugin, getPanelType } from '../panels/registry';
import { clearRuntimeTheme, setRuntimeTheme } from '../shims/grafana-runtime';

export interface EmbedPanelRendererProps {
  /** Dashboard v2 `spec.vizConfig.group`. */
  pluginId: string;
  title?: string;
  data: PanelData;
  /** Live field config: starts as the panel's, then evolves with interaction. */
  fieldConfig: FieldConfigSource;
  options: Record<string, unknown>;
  width: number;
  height: number;
  timeZone: string;
  onFieldConfigChange: (fieldConfig: FieldConfigSource) => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/** An embed owns no template variables; the host interpolates before handing over panel JSON. */
const noopReplace = (value: string) => value;

/**
 * Mirrors public/app/features/panel/components/PanelRenderer.tsx, which is already
 * Grafana's standalone single-panel renderer (Explore and alerting rule preview use
 * it). Two deliberate differences: the plugin comes from the embed's static registry
 * instead of the async plugin importer, and getTemplateSrv/appEvents are dropped.
 */
export function EmbedPanelRenderer({
  pluginId,
  title,
  data,
  fieldConfig,
  options,
  width,
  height,
  timeZone,
  onFieldConfigChange,
  onChangeTimeRange,
}: EmbedPanelRendererProps) {
  const theme = useTheme2();
  const plugin = getPanelPlugin(pluginId);
  const panelType = getPanelType(pluginId);

  const mergedOptions = useMemo(() => mergeDeep(panelType?.optionDefaults ?? {}, options), [panelType, options]);

  const optionsWithDefaults = useMemo(() => {
    if (!plugin) {
      return undefined;
    }
    return getPanelOptionsWithDefaults({
      plugin,
      currentOptions: mergedOptions,
      currentFieldConfig: fieldConfig,
      isAfterPluginChange: false,
    });
  }, [plugin, mergedOptions, fieldConfig]);

  // GraphNG rebuilds its uPlot config only when structureRev changes, so anything
  // baked into that config at build time never reaches the plot without a bump.
  // useFieldOverrides bumps only on series-structure change, so the embed owns the
  // counter. Three inputs matter:
  //   - field config: otherwise legend toggles appear dead
  //   - series structure: otherwise a re-query that alters the series set renders stale
  //   - theme: axis and crosshair colours are drawn onto the canvas, so a host palette
  //     change would otherwise leave the old colours on screen
  const structureRev = useStructureRev(fieldConfig, data.series, theme);
  const dataWithRev = useMemo(() => ({ ...data, structureRev }), [data, structureRev]);

  const dataWithOverrides = useFieldOverrides(
    plugin,
    optionsWithDefaults?.fieldConfig,
    dataWithRev,
    timeZone,
    theme,
    noopReplace
  );

  const eventBus = useMemo(() => new EventBusSrv(), []);

  // Identifies this panel to the runtime shim's theme tracking.
  const themeOwner = useRef({}).current;
  useEffect(() => () => clearRuntimeTheme(themeOwner), [themeOwner]);

  // The context value must be referentially stable: a fresh object per render
  // destabilizes VizLayout's measure cycle and uPlot never initializes on first
  // mount. Mutable state is reached through a ref.
  const toggleState = useRef({ fieldConfig, series: data.series });
  toggleState.current = { fieldConfig, series: data.series };

  const panelContext: PanelContext = useMemo(
    () => ({
      eventsScope: 'grafana-embed',
      eventBus,
      sync: () => DashboardCursorSync.Off,
      onToggleSeriesVisibility: (label: string | string[] | null, mode: SeriesVisibilityChangeMode) => {
        if (typeof label !== 'string') {
          return;
        }
        const { fieldConfig: fc, series } = toggleState.current;
        onFieldConfigChange(seriesVisibilityConfigFactory(label, mode, fc, series));
      },
    }),
    [eventBus, onFieldConfigChange]
  );

  if (!plugin || !plugin.panel) {
    return <Message theme={theme}>Unsupported panel type: {pluginId}</Message>;
  }
  if (!dataWithOverrides) {
    return <Message theme={theme}>No panel data</Message>;
  }

  // As late as possible, so the window in which a second panel can overwrite this
  // module global before our own subtree renders is as small as it can be.
  setRuntimeTheme(theme, themeOwner);

  const PanelComponent = plugin.panel;

  return (
    <ErrorBoundaryAlert boundaryName="grafana-embed" dependencies={[plugin, data]}>
      <PluginContextProvider meta={plugin.meta}>
        <PanelContextProvider value={panelContext}>
          <PanelComponent
            id={1}
            data={dataWithOverrides}
            title={title ?? ''}
            timeRange={dataWithOverrides.timeRange}
            timeZone={timeZone}
            options={optionsWithDefaults!.options}
            fieldConfig={fieldConfig}
            transparent={false}
            width={width}
            height={height}
            renderCounter={0}
            replaceVariables={noopReplace}
            onOptionsChange={noop}
            onFieldConfigChange={noop}
            onChangeTimeRange={onChangeTimeRange ?? noop}
            eventBus={eventBus}
          />
        </PanelContextProvider>
      </PluginContextProvider>
    </ErrorBoundaryAlert>
  );
}

function Message({ children, theme }: { children: React.ReactNode; theme: ReturnType<typeof useTheme2> }) {
  return <div style={{ padding: 8, fontSize: 12, color: theme.colors.text.secondary }}>{children}</div>;
}

const noop = () => {};

/**
 * Bumps on field config, frame structure or theme change. Callers must keep
 * fieldConfig and theme referentially stable across renders that did not change them,
 * or the plot config is rebuilt on every render.
 */
function useStructureRev(
  fieldConfig: FieldConfigSource,
  series: DataFrame[] | undefined,
  theme: GrafanaTheme2
): number {
  const rev = useRef(1);
  const prevFieldConfig = useRef(fieldConfig);
  const prevSeries = useRef(series);
  const prevTheme = useRef(theme);

  if (prevFieldConfig.current !== fieldConfig) {
    prevFieldConfig.current = fieldConfig;
    rev.current++;
  }
  if (prevTheme.current !== theme) {
    prevTheme.current = theme;
    rev.current++;
  }
  if (
    series &&
    prevSeries.current &&
    series !== prevSeries.current &&
    !compareArrayValues(series, prevSeries.current, compareDataFrameStructures)
  ) {
    rev.current++;
  }
  prevSeries.current = series;

  return rev.current;
}

/** Panel JSON often carries partial nested option objects; defaults must survive them. */
function mergeDeep(defaults: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    const base = out[key];
    out[key] = isPlainObject(base) && isPlainObject(value) ? mergeDeep(base, value) : value;
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
