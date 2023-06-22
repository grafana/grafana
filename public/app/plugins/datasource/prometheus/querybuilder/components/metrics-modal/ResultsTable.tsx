import { css } from '@emotion/css';
import React, { ReactElement, useEffect, useRef, useState } from 'react';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useTheme2 } from '@grafana/ui';

import { docsTip } from '../../../configuration/ConfigEditor';
import { PromVisualQuery } from '../../types';

import { tracking } from './state/helpers';
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

  const [clickLocation, setClickLocation] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  function isSelectedRow(idx: number): boolean {
    return idx === selectedIdx;
  }

  function selectMetric(metric: MetricData) {
    if (metric.value) {
      onChange({ ...query, metric: metric.value });
      tracking('grafana_prom_metric_encycopedia_tracking', state, metric.value);
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
          <td>{displayType(metric.type ?? '')}</td>
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
          <td>{displayType(metric.type ?? '')}</td>
          <td>{metric.description ?? ''}</td>
        </>
      );
    }
  }

  function addHelpIcon(fullType: string, descriptiveType: string, link: string) {
    return (
      <>
        {fullType}
        <span className={styles.tooltipSpace}>
          <Tooltip
            content={
              <>
                When creating a {descriptiveType}, Prometheus exposes multiple series with the type counter.{' '}
                {docsTip(link)}
              </>
            }
            placement="bottom-start"
            interactive={true}
          >
            <Icon name="info-circle" size="xs" />
          </Tooltip>
        </span>
      </>
    );
  }

  function displayType(type: string | null) {
    if (!type) {
      return '';
    }

    if (type.includes('(summary)')) {
      return addHelpIcon(type, 'summary', 'https://prometheus.io/docs/concepts/metric_types/#summary');
    }

    if (type.includes('(histogram)')) {
      return addHelpIcon(type, 'histogram', 'https://prometheus.io/docs/concepts/metric_types/#histogram');
    }

    return type;
  }

  function noMetricsMessages(): ReactElement {
    let message;

    if (!state.fuzzySearchQuery) {
      message = 'There are no metrics found in the data source.';
    }

    if (query.labels.length > 0) {
      message = 'There are no metrics found. Try to expand your label filters.';
    }

    if (state.fuzzySearchQuery || state.selectedTypes.length > 0) {
      message = 'There are no metrics found. Try to expand your search and filters.';
    }

    return (
      <tr className={styles.noResults}>
        <td colSpan={3}>{message}</td>
      </tr>
    );
  }

  function textHighlight(state: MetricsModalState) {
    if (state.useBackend) {
      // highlight the input only for the backend search
      // this highlight is equivalent to how the metric select highlights
      // look into matching on regex input
      return [state.fuzzySearchQuery];
    } else if (state.fullMetaSearch) {
      // highlight the matches in the ufuzzy metaHaystack
      return state.metaHaystackMatches;
    } else {
      // highlight the ufuzzy name matches
      return state.nameHaystackMatches;
    }
  }

  return (
    <table className={styles.table} ref={tableRef}>
      <thead className={styles.stickyHeader}>
        <tr>
          <th className={`${styles.nameWidth} ${styles.tableHeaderPadding}`}>Name</th>
          {state.hasMetadata && (
            <>
              <th className={`${styles.typeWidth} ${styles.tableHeaderPadding}`}>Type</th>
              <th className={`${styles.descriptionWidth} ${styles.tableHeaderPadding}`}>Description</th>
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
                  onFocus={() => onFocusRow(idx)}
                  onMouseDown={(e) => {
                    setClickLocation({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseUp={(e) => {
                    if (clickLocation.x === e.clientX && clickLocation.y === e.clientY) {
                      selectMetric(metric);
                    }
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.code === 'Enter' && e.currentTarget.classList.contains('selected-row')) {
                      selectMetric(metric);
                    }
                  }}
                >
                  <td className={styles.nameOverflow}>
                    <Highlighter
                      textToHighlight={metric?.value ?? ''}
                      searchWords={textHighlight(state)}
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
      border-bottom: 1px solid ${theme.colors.border.weak}
      &:last-child {
        border-bottom: 0;
      }
      :hover {
        background-color: ${rowHoverBg};
        cursor: pointer;
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
      ${disableTextWrap ? '' : 'width: 37.5%;'}
    `,
    nameOverflow: css`
      ${disableTextWrap ? '' : 'overflow-wrap: anywhere;'}
    `,
    typeWidth: css`
      ${disableTextWrap ? '' : 'width: 15%;'}
    `,
    descriptionWidth: css`
      ${disableTextWrap ? '' : 'width: 47.5%;'}
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
    tooltipSpace: css`
      margin-left: 4px;
    `,
    centerButton: css`
      display: block;
      margin: auto;
      border: none;
    `,
  };
};
