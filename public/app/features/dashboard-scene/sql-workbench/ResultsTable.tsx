import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { Button, RadioButtonGroup, Spinner, Text, useStyles2 } from '@grafana/ui';

import { simulateGithubQuery, simulateQuery } from './queryResults';

type ViewMode = 'table' | 'viz';

const VIEW_MODE_OPTIONS: Array<{ label: string; value: ViewMode }> = [
  { label: 'Table', value: 'table' },
  { label: 'Visualization', value: 'viz' },
];

interface Props {
  sql: string;
  autoRun?: boolean;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  datasource?: 'prometheus' | 'github';
}

export function ResultsTable({ sql, autoRun = false, viewMode = 'table', onViewModeChange, datasource = 'prometheus' }: Props) {
  const styles = useStyles2(getStyles);
  const [results, setResults] = useState<DataFrame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const runCountRef = useRef(0);

  const runQuery = () => {
    const id = ++runCountRef.current;
    setIsLoading(true);

    const delay = 300 + Math.random() * 300;
    setTimeout(() => {
      if (id !== runCountRef.current) {
        return;
      }
      setResults(datasource === 'github' ? simulateGithubQuery(sql) : simulateQuery(sql));
      setIsLoading(false);
      setHasRun(true);
    }, delay);
  };

  useEffect(() => {
    if (autoRun) {
      runQuery();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Text variant="bodySmall" weight="bold" color="secondary">
          RESULTS
        </Text>
        <Button
          size="sm"
          variant="secondary"
          icon={isLoading ? undefined : 'play'}
          onClick={runQuery}
          disabled={isLoading}
        >
          {isLoading ? <Spinner size="sm" /> : 'Run'}
        </Button>
        {hasRun && !isLoading && (
          <Text variant="bodySmall" color="secondary">
            {results.reduce((n, f) => n + f.length, 0)} rows · {results.length} series
          </Text>
        )}
        <div className={styles.toolbarRight}>
          <RadioButtonGroup options={VIEW_MODE_OPTIONS} value={viewMode} onChange={onViewModeChange} size="sm" />
        </div>
      </div>

      <div className={styles.tableWrap}>
        {!hasRun && !isLoading && (
          <div className={styles.empty}>
            <Text color="secondary" variant="bodySmall">
              Press Run (or Ctrl+Enter) to execute the query
            </Text>
          </div>
        )}
        {isLoading && (
          <div className={styles.empty}>
            <Spinner />
          </div>
        )}
        {hasRun &&
          !isLoading &&
          results.length > 0 &&
          (viewMode === 'viz' ? <VisualizationPreview frames={results} /> : <DataFrameTable frames={results} />)}
      </div>
    </div>
  );
}

function DataFrameTable({ frames }: { frames: DataFrame[] }) {
  const styles = useStyles2(getTableStyles);
  const visible = frames.slice(0, 5);

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {visible[0].fields.map((f) => (
            <th key={f.name} className={styles.th}>
              {f.name}
            </th>
          ))}
          {visible.length > 1 && <th className={styles.th}>series</th>}
        </tr>
      </thead>
      <tbody>
        {visible.flatMap((frame, fi) =>
          Array.from({ length: Math.min(frame.length, 8) }, (_, ri) => (
            <tr key={`${fi}-${ri}`} className={styles.tr}>
              {frame.fields.map((field, ci) => {
                const raw = (field.values as unknown[])[ri];
                const display =
                  typeof raw === 'number'
                    ? field.name === 'time'
                      ? new Date(raw).toLocaleTimeString()
                      : Number.isInteger(raw)
                        ? String(raw)
                        : raw.toFixed(4)
                    : String(raw ?? '');
                return (
                  <td key={ci} className={styles.td}>
                    {display}
                  </td>
                );
              })}
              {visible.length > 1 && <td className={styles.td}>{frame.name}</td>}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function VisualizationPreview({ frames }: { frames: DataFrame[] }) {
  const styles = useStyles2(getVizPreviewStyles);
  const COLORS = ['#5794F2', '#FF780A', '#37872D', '#B877D9', '#CA6D00'];

  const series = frames
    .slice(0, 10)
    .map((frame, fi) => {
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
    })
    .filter(Boolean);

  if (series.length === 0) {
    return (
      <div className={styles.empty}>
        <Text color="secondary" variant="bodySmall">
          No data to visualize
        </Text>
      </div>
    );
  }

  const allVals = series.flatMap((s) => s!.values);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;

  const toPath = (vals: number[], W: number, H: number) => {
    if (vals.length === 0) {
      return '';
    }
    return vals
      .map((v, i) => {
        const x = (i / (vals.length - 1)) * W;
        const y = H - ((v - min) / range) * (H - 16) - 8;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className={styles.root}>
      <div className={styles.chartWrap}>
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 800 200">
          {series.map((s) => (
            <path
              key={s!.name}
              d={toPath(s!.values, 800, 200)}
              fill="none"
              stroke={s!.color}
              strokeWidth={2}
              opacity={0.85}
            />
          ))}
        </svg>
      </div>
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
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    toolbar: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      padding: theme.spacing(0.75, 1.5),
      background: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      flexShrink: 0,
    }),
    toolbarRight: css({
      marginLeft: 'auto',
    }),
    tableWrap: css({ flex: 1, overflow: 'auto' }),
    empty: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: theme.spacing(2),
    }),
  };
}

function getVizPreviewStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: theme.spacing(2),
      gap: theme.spacing(1),
    }),
    chartWrap: css({
      flex: 1,
      minHeight: 0,
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
    }),
    empty: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    }),
    legend: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5, 1.5),
      flexShrink: 0,
    }),
    legendItem: css({
      fontSize: '11px',
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
  };
}

function getTableStyles(theme: GrafanaTheme2) {
  return {
    table: css({
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
    th: css({
      position: 'sticky',
      top: 0,
      background: theme.colors.background.secondary,
      padding: theme.spacing(0.5, 1.5),
      textAlign: 'left',
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    tr: css({
      '&:nth-child(even)': { background: theme.colors.background.secondary },
      '&:hover': { background: theme.colors.action.hover },
    }),
    td: css({
      padding: theme.spacing(0.25, 1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.primary,
      whiteSpace: 'nowrap',
    }),
  };
}
