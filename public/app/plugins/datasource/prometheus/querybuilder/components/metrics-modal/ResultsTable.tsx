import { css } from '@emotion/css';
import React, { useEffect, useRef } from 'react';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';

import { PromVisualQuery } from '../../types';

import { MetricsModalState } from './state/state';
import { MetricData, MetricsData } from './types';

type ResultsTableProps = {
  metrics: MetricsData;
  onChange: (query: PromVisualQuery) => void;
  onClose: () => void;
  query: PromVisualQuery;
  state: MetricsModalState;
  selectedIdx: number;
  disableTextWrap: boolean;
};

export function ResultsTable(props: ResultsTableProps) {
  const { metrics, onChange, onClose, query, state, selectedIdx, disableTextWrap } = props;

  const theme = useTheme2();
  const styles = getStyles(theme, disableTextWrap);

  const tableRef = useRef<HTMLTableElement | null>(null);

  function isSelectedRow(idx: number): boolean {
    return idx === selectedIdx;
  }

  function selectMetric(metric: MetricData) {
    if (metric.value) {
      onChange({ ...query, metric: metric.value });
      reportInteraction('grafana_prom_metric_encycopedia_tracking', {
        metric: metric.value,
        hasMetadata: state.hasMetadata,
        totalMetricCount: state.totalMetricCount,
        fuzzySearchQuery: state.fuzzySearchQuery,
        fullMetaSearch: state.fullMetaSearch,
        selectedTypes: state.selectedTypes,
        letterSearch: state.letterSearch,
      });
      onClose();
    }
  }

  useEffect(() => {
    const tr = tableRef.current?.getElementsByClassName('selected-row')[0];
    tr?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedIdx]);

  function metaRows(metric: MetricData) {
    if (state.fullMetaSearch && metric) {
      return (
        <>
          <td>
            <Highlighter
              textToHighlight={metric.type ?? ''}
              searchWords={state.metaHaystackMatches}
              autoEscape
              highlightClassName={styles.matchHighLight}
            />
          </td>
          <td>
            <Highlighter
              textToHighlight={metric.description ?? ''}
              searchWords={state.metaHaystackMatches}
              autoEscape
              highlightClassName={styles.matchHighLight}
            />
          </td>
        </>
      );
    } else {
      return (
        <>
          <td>{metric.type ?? ''}</td>
          <td>{metric.description ?? ''}</td>
        </>
      );
    }
  }

  return (
    <table className={styles.table} ref={tableRef}>
      <thead>
        <tr className={styles.header}>
          <th>Name</th>
          {state.hasMetadata && (
            <>
              <th>Type</th>
              <th>Description</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        <>
          {metrics &&
            metrics.map((metric: MetricData, idx: number) => {
              return (
                <tr
                  key={metric?.value ?? idx}
                  className={`${styles.row} ${isSelectedRow(idx) ? `${styles.selectedRow} selected-row` : ''}`}
                  onClick={() => selectMetric(metric)}
                >
                  <td>
                    <Highlighter
                      textToHighlight={metric?.value ?? ''}
                      searchWords={state.fullMetaSearch ? state.metaHaystackMatches : state.nameHaystackMatches}
                      autoEscape
                      highlightClassName={styles.matchHighLight}
                    />
                  </td>
                  {state.hasMetadata && metaRows(metric)}
                </tr>
              );
            })}
        </>
      </tbody>
    </table>
  );
}

const getStyles = (theme: GrafanaTheme2, disableTextWrap: boolean) => {
  const rowHoverBg = theme.colors.emphasize(theme.colors.background.primary, 0.03);

  return {
    table: css`
      border-radius: ${theme.shape.borderRadius()};
      width: 100%;
      white-space: ${disableTextWrap ? 'nowrap' : 'normal'};
      td {
        padding: ${theme.spacing(1)};
      }

      td,
      th {
        min-width: ${theme.spacing(3)};
      }
    `,
    header: css`
      border-bottom: 1px solid ${theme.colors.border.weak};
    `,
    row: css`
      label: row;
      cursor: pointer;
      border-bottom: 1px solid ${theme.colors.border.weak}
      &:last-child {
        border-bottom: 0;
      }
      :hover {
        background-color: ${rowHoverBg};
      }
    `,
    selectedRow: css`
      background-color: ${rowHoverBg};
    `,
    matchHighLight: css`
      background: inherit;
      color: ${theme.components.textHighlight.text};
      background-color: ${theme.components.textHighlight.background};
    `,
  };
};
