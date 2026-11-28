import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import {
  type FieldConfigSource,
  FieldMatcherID,
  FieldType,
  type GrafanaTheme2,
  type IconName,
  LoadingState,
  type PanelData,
  createDataFrame,
  dateTime,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelRenderer } from '@grafana/runtime';
import { BarAlignment, GraphDrawStyle, LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/schema';
import { Icon, LinkButton, PanelChrome, Text, useStyles2 } from '@grafana/ui';

import { type ChartSeries, type ChartState } from '../serviceCharts';

const CHART_HEIGHT = 170;

// Stacks from the bottom up, so the problem ends on top.
const STACK_ORDER = ['ok', 'error'];

const COLORS: Record<string, string> = {
  ok: 'blue',
  error: 'red',
};

const DISPLAY_NAMES: Record<string, string> = { ok: 'OK', error: 'Error' };

interface Props {
  title: string;
  icon: IconName;
  subtitle: string;
  // Undefined while the query runs.
  state?: ChartState;
  // What the chart says when the query ran and the service has nothing in this data source.
  emptyText: string;
  // The header action, which opens the Drilldown app that shows the same signal for this service. Without a URL the
  // chart has no action.
  openLabel: string;
  openUrl?: string;
}

export function PanelTitle({ icon, title }: { icon: IconName; title: string }) {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.title}>
      <Icon name={icon} />
      {title}
    </span>
  );
}

export function ServiceChart({ title, icon, subtitle, state, emptyText, openLabel, openUrl }: Props) {
  return (
    <PanelChrome
      title={<PanelTitle icon={icon} title={title} />}
      subtitle={subtitle}
      loadingState={state ? undefined : LoadingState.Loading}
      statusMessage={state?.kind === 'error' ? state.message : undefined}
      actions={
        openUrl ? (
          <LinkButton href={openUrl} size="sm" variant="secondary" fill="outline" icon={icon}>
            {openLabel}
          </LinkButton>
        ) : undefined
      }
    >
      {state?.kind === 'data' ? (
        <Chart series={state.series} />
      ) : (
        // The message keeps the chart's height, so a row does not change size when its data arrives.
        <div style={{ height: CHART_HEIGHT }}>
          <Text color="secondary">{messageFor(state, emptyText)}</Text>
        </div>
      )}
    </PanelChrome>
  );
}

export function messageFor(state: ChartState | undefined, emptyText: string) {
  switch (state?.kind) {
    case 'empty':
      return emptyText;
    case 'no-source':
      return t('drilldown-real.services.chart-no-source', 'Not set up yet');
    case 'error':
      return t('drilldown-real.services.chart-error', 'Not measured');
    default:
      return '';
  }
}

function Chart({ series }: { series: ChartSeries[] }) {
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  const ordered = useMemo(
    () => [...series].sort((a, b) => STACK_ORDER.indexOf(a.name) - STACK_ORDER.indexOf(b.name)),
    [series]
  );
  const data = useMemo(() => buildPanelData(ordered), [ordered]);
  const fieldConfig = useMemo(() => buildFieldConfig(ordered), [ordered]);
  // The panel reads its options by reference, so they keep one identity while the series stay the same.
  const options = useMemo(
    () => ({
      legend: { showLegend: true, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
      tooltip: { mode: TooltipDisplayMode.Multi },
    }),
    []
  );

  return (
    // The padding leaves room for the last time label, which the axis draws half beyond the plot.
    <div ref={measureRef} style={{ height: CHART_HEIGHT, paddingRight: 16 }}>
      {width > 0 && (
        <PanelRenderer
          title=""
          pluginId="timeseries"
          width={width}
          height={CHART_HEIGHT}
          data={data}
          options={options}
          fieldConfig={fieldConfig}
        />
      )}
    </div>
  );
}

function buildFieldConfig(series: ChartSeries[]): FieldConfigSource {
  return {
    defaults: {
      unit: 'short',
      color: { mode: 'palette-classic' },
      custom: {
        drawStyle: GraphDrawStyle.Bars,
        barAlignment: BarAlignment.Center,
        barWidthFactor: 0.8,
        fillOpacity: 90,
        lineWidth: 0,
        stacking: { mode: StackingMode.Normal, group: 'A' },
      },
    },
    overrides: series.flatMap(({ name }) =>
      COLORS[name]
        ? [
            {
              matcher: { id: FieldMatcherID.byName, options: DISPLAY_NAMES[name] ?? name },
              properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: COLORS[name] } }],
            },
          ]
        : []
    ),
  };
}

// The series share one time field. A count stacks, so a point a series lacks counts as zero there.
function buildPanelData(series: ChartSeries[]): PanelData {
  const times = [...new Set(series.flatMap((one) => one.times).filter(Number.isFinite))].sort((a, b) => a - b);
  const frame = createDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: times },
      ...series.map((one) => {
        const byTime = new Map<number, number>(one.times.map((time, index) => [time, one.values[index]]));
        return {
          name: DISPLAY_NAMES[one.name] ?? one.name,
          type: FieldType.number,
          values: times.map((time) => {
            const value = byTime.get(time);
            return value !== undefined && Number.isFinite(value) ? value : 0;
          }),
        };
      }),
    ],
  });
  const from = dateTime(times[0] ?? 0);
  const to = dateTime(times.at(-1) ?? 0);

  return { state: LoadingState.Done, series: [frame], timeRange: { from, to, raw: { from, to } } };
}

const getStyles = (theme: GrafanaTheme2) => ({
  title: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
});
