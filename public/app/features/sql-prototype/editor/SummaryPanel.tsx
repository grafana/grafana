import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { Spinner, Text, useStyles2 } from '@grafana/ui';

import { getQuerySummary, simulateQuery } from '../mocks/queryResults';

interface Props {
  sql: string;
  selection?: string;
}

export function SummaryPanel({ sql, selection }: Props) {
  const styles = useStyles2(getStyles);
  const [frames, setFrames] = useState<DataFrame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const effectiveSql = selection?.trim() || sql;

  useEffect(() => {
    clearTimeout(timerRef.current);
    setIsLoading(true);
    timerRef.current = setTimeout(() => {
      setFrames(simulateQuery(effectiveSql));
      setIsLoading(false);
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [effectiveSql]);

  const summary = useMemo(() => (frames.length > 0 ? getQuerySummary(frames) : null), [frames]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text variant="bodySmall" weight="bold" color="secondary">
          SUMMARY
        </Text>
        {selection && (
          <Text variant="bodySmall" color="secondary">
            (selection)
          </Text>
        )}
      </div>

      {isLoading && (
        <div className={styles.center}>
          <Spinner />
        </div>
      )}

      {!isLoading && summary && (
        <>
          <div className={styles.statsGrid}>
            <StatCard label="Rows" value={summary.rowCount} />
            <StatCard label="Series" value={summary.seriesCount} />
            <StatCard label="Min" value={summary.minValue} />
            <StatCard label="Max" value={summary.maxValue} />
            <StatCard label="Avg" value={summary.avgValue} />
          </div>

          <div className={styles.chartSection}>
            <Text variant="bodySmall" color="secondary">
              Preview
            </Text>
            <Sparklines frames={frames} />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  const styles = useStyles2(getStatStyles);
  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
    </div>
  );
}

function Sparklines({ frames }: { frames: DataFrame[] }) {
  const styles = useStyles2(getSparkStyles);
  const COLORS = ['#5794F2', '#FF780A', '#37872D', '#B877D9', '#CA6D00'];

  const series = frames.slice(0, 5).map((frame, fi) => {
    const valueField = frame.fields.find((f) => f.name !== 'time');
    if (!valueField) {
      return null;
    }
    const vals: number[] = [];
    for (let i = 0; i < valueField.values.length; i++) {
      const v = (valueField.values as number[])[i];
      if (typeof v === 'number' && !isNaN(v)) {
        vals.push(v);
      }
    }
    return { name: frame.name, values: vals, color: COLORS[fi % COLORS.length] };
  }).filter(Boolean);

  if (series.length === 0) {
    return null;
  }

  const allVals = series.flatMap((s) => s!.values);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;

  const W = 260;
  const H = 100;

  const toPath = (vals: number[]) => {
    if (vals.length === 0) {
      return '';
    }
    return vals
      .map((v, i) => {
        const x = (i / (vals.length - 1)) * W;
        const y = H - ((v - min) / range) * H;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className={styles.root}>
      <svg width={W} height={H} className={styles.svg}>
        {series.map((s) => (
          <path
            key={s!.name}
            d={toPath(s!.values)}
            fill="none"
            stroke={s!.color}
            strokeWidth={1.5}
            opacity={0.85}
          />
        ))}
      </svg>
      <div className={styles.legend}>
        {series.map((s) => (
          <span key={s!.name} className={styles.legendItem} style={{ color: s!.color }}>
            ─ {s!.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: theme.colors.background.primary,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      overflow: 'auto',
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1.5, 2, 0.5),
    }),
    center: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(3),
    }),
    statsGrid: css({
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),
    chartSection: css({
      padding: theme.spacing(1, 2),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
  };
}

function getStatStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }),
    label: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    value: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightBold,
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
  };
}

function getSparkStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    svg: css({
      display: 'block',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    }),
    legend: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5, 1),
    }),
    legendItem: css({
      fontSize: '11px',
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
  };
}
