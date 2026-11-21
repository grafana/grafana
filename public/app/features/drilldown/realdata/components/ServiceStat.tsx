import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import {
  type Field,
  type FieldConfig,
  FieldType,
  type GrafanaTheme2,
  type IconName,
  LoadingState,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { type GraphFieldConfig, LineInterpolation } from '@grafana/schema';
import { LinkButton, PanelChrome, Sparkline, Text, useStyles2, useTheme2 } from '@grafana/ui';

import { type ChartState } from '../serviceCharts';

import { PanelTitle, messageFor } from './ServiceChart';

const SPARKLINE_HEIGHT = 40;

export type StatTone = 'neutral' | 'error';

interface Props {
  icon: IconName;
  title: string;
  // What the number counts, under it.
  caption: string;
  // Undefined while the query runs.
  state?: ChartState;
  // Turns the latest value into the text of the number.
  format: (value: number) => string;
  // The color of the number and the line for the latest value.
  tone?: (value: number) => StatTone;
  // What the card says when the query ran and the service has nothing in this data source.
  emptyText: string;
  appName: string;
  // The Drilldown app that shows the same signal for this service. Without one the card has no arrow.
  openUrl?: string;
}

const neutral = () => 'neutral' as const;

export function ServiceStat({
  icon,
  title,
  caption,
  state,
  format,
  tone = neutral,
  emptyText,
  appName,
  openUrl,
}: Props) {
  const styles = useStyles2(getStyles);
  const series = state?.kind === 'data' ? state.series[0] : undefined;
  const latest = series?.values.filter(Number.isFinite).at(-1);
  const color = latest !== undefined && tone(latest) === 'error' ? 'error' : 'primary';

  return (
    <PanelChrome
      title={<PanelTitle icon={icon} title={title} />}
      loadingState={state ? undefined : LoadingState.Loading}
      statusMessage={state?.kind === 'error' ? state.message : undefined}
      actions={
        openUrl ? (
          <LinkButton
            href={openUrl}
            size="sm"
            variant="secondary"
            fill="text"
            icon="arrow-right"
            aria-label={t('drilldown-real.services.open-in-app', 'Open in {{app}}', { app: appName })}
          />
        ) : undefined
      }
    >
      <div className={styles.body}>
        {series && latest !== undefined ? (
          <>
            <div className={styles.figure}>
              <Text element="p" variant="h2" color={color}>
                {format(latest)}
              </Text>
              <Text variant="bodySmall" color="secondary">
                {caption}
              </Text>
            </div>
            <div className={styles.line}>
              <StatSparkline values={series.values} color={color === 'error' ? 'red' : 'blue'} />
            </div>
          </>
        ) : (
          <Text color="secondary">{messageFor(state, emptyText)}</Text>
        )}
      </div>
    </PanelChrome>
  );
}

type SparkColor = 'blue' | 'red';

// Module-level so Sparkline (memo) sees a stable config reference across renders.
const CONFIGS: Record<SparkColor, FieldConfig<GraphFieldConfig>> = {
  blue: makeConfig('blue'),
  red: makeConfig('red'),
};

function StatSparkline({ values, color }: { values: number[]; color: SparkColor }) {
  const theme = useTheme2();
  // A bare flex child gives Sparkline width 0, and uPlot throws at width 0.
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  const sparkline = useMemo(() => toSparkline(values), [values]);

  return (
    <div ref={measureRef} style={{ height: SPARKLINE_HEIGHT }}>
      {width > 0 && (
        <Sparkline
          width={width}
          height={SPARKLINE_HEIGHT}
          sparkline={sparkline}
          config={CONFIGS[color]}
          theme={theme}
        />
      )}
    </div>
  );
}

function makeConfig(color: SparkColor): FieldConfig<GraphFieldConfig> {
  return {
    color: { mode: 'fixed', fixedColor: color },
    custom: { lineWidth: 1.5, fillOpacity: 15, lineInterpolation: LineInterpolation.Linear },
  };
}

// The line starts at zero, so a small change in a small number does not fill the height.
function toSparkline(values: number[]) {
  const y: Field = { name: 'value', type: FieldType.number, values, config: {} };
  const max = Math.max(0, ...values.filter(Number.isFinite)) || 1;
  return { y: { ...y, state: { range: { min: 0, max, delta: max } } } };
}

const getStyles = (theme: GrafanaTheme2) => ({
  body: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    minHeight: theme.spacing(8),
  }),
  figure: css({
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    '& p': { margin: 0 },
  }),
  line: css({
    flex: 1,
    minWidth: theme.spacing(8),
  }),
});
