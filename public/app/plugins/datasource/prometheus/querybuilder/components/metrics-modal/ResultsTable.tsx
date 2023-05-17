import { css } from '@emotion/css';
import React, { ReactElement, useEffect, useRef } from 'react';
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
  onFocusRow: (idx: number) => void;
};

export function ResultsTable(props: ResultsTableProps) {
  const { metrics, onChange, onClose, query, state, selectedIdx, disableTextWrap, onFocusRow } = props;

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
        disableTextWrap: state.disableTextWrap,
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

  function noMetricsMessages(): ReactElement {
    let message;

    if (!state.fuzzySearchQuery) {
      message = 'There are no metrics found in the data source.';
    }

    if (query.labels.length > 0) {
      message = 'There are no metrics found. Try to expand your label filters.';
    }

    if (state.fuzzySearchQuery) {
      message = 'There are no metrics found. Try to expand your search and filters.';
    }

    return (
      <tr className={styles.noResults}>
        <td colSpan={3}>{message}</td>
      </tr>
    );
  }

  return (
    <table className={styles.table} ref={tableRef}>
      <thead className={styles.stickyHeader}>
        <tr>
          <th className={`${styles.nameWidth} ${styles.tableHeaderPadding}`}>Name</th>
          {state.hasMetadata && (
            <>
              <th className={`${styles.typeWidth} ${styles.tableHeaderPadding}`}>Type</th>
              <th className={styles.tableHeaderPadding}>Description</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        <>
          {metrics.length > 0 &&
            metrics.map((metric: MetricData, idx: number) => {
              return (
                <tr
                  key={metric?.value ?? idx}
                  className={`${styles.row} ${isSelectedRow(idx) ? `${styles.selectedRow} selected-row` : ''}`}
                  onClick={() => selectMetric(metric)}
                  tabIndex={0}
                  onFocus={() => onFocusRow(idx)}
                  onKeyDown={(e) => {
                    if (e.code === 'Enter' && e.currentTarget.classList.contains('selected-row')) {
                      selectMetric(metric);
                    }
                  }}
                >
                  <td className={styles.nameOverflow}>
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
          {metrics.length === 0 && !state.isLoading && noMetricsMessages()}
        </>
      </tbody>
    </table>
  );
}

const getStyles = (theme: GrafanaTheme2, disableTextWrap: boolean) => {
  const rowHoverBg = theme.colors.emphasize(theme.colors.background.primary, 0.03);

  return {
    table: css`
      ${disableTextWrap ? '' : 'table-layout: fixed;'}
      border-radius: ${theme.shape.borderRadius()};
      width: 100%;
      height: 100%;
      white-space: ${disableTextWrap ? 'nowrap' : 'normal'};
      td {
        padding: ${theme.spacing(1)};
      }

      td,
      th {
        min-width: ${theme.spacing(3)};
        border-bottom: 1px solid ${theme.colors.border.weak};
      }
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
    tableHeaderPadding: css`
      padding: 8px;
    `,
    selectedRow: css`
      background-color: ${rowHoverBg};
    `,
    matchHighLight: css`
      background: inherit;
      color: ${theme.components.textHighlight.text};
      background-color: ${theme.components.textHighlight.background};
    `,
    nameWidth: css`
      ${disableTextWrap ? '' : 'width: 40%;'}
    `,
    nameOverflow: css`
      ${disableTextWrap ? '' : 'overflow-wrap: anywhere;'}
    `,
    typeWidth: css`
      ${disableTextWrap ? '' : 'width: 15%;'}
    `,
    stickyHeader: css`
      position: sticky;
      top: 0;
      background-color: ${theme.colors.background.primary};
    `,
    noResults: css`
      text-align: center;
      color: ${theme.colors.text.secondary};
    `,
  };
};
