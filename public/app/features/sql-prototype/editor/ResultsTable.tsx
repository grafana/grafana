import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, Text, useStyles2 } from '@grafana/ui';

import { simulateQuery } from '../mocks/queryResults';

interface Props {
  sql: string;
  autoRun?: boolean;
}

export function ResultsTable({ sql, autoRun = false }: Props) {
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
      setResults(simulateQuery(sql));
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
        {hasRun && !isLoading && results.length > 0 && (
          <DataFrameTable frames={results} />
        )}
      </div>
    </div>
  );
}

function DataFrameTable({ frames }: { frames: DataFrame[] }) {
  const styles = useStyles2(getTableStyles);

  // Show first 5 frames, max 8 rows each
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
    tableWrap: css({
      flex: 1,
      overflow: 'auto',
    }),
    empty: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: theme.spacing(2),
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
      '&:nth-child(even)': {
        background: theme.colors.background.secondary,
      },
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    td: css({
      padding: theme.spacing(0.25, 1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.primary,
      whiteSpace: 'nowrap',
    }),
  };
}
