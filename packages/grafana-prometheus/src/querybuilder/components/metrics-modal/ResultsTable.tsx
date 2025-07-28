// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/ResultsTable.tsx
import { css } from '@emotion/css';
import { ReactElement, useMemo } from 'react';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, Tooltip, useTheme2 } from '@grafana/ui';

import { docsTip } from '../../../configuration/shared/utils';
import { PromVisualQuery } from '../../types';

import { useMetricsModal } from './MetricsModalContext';
import { MetricData } from './types';

type ResultsTableProps = {
  onChange: (query: PromVisualQuery) => void;
  onClose: () => void;
  query: PromVisualQuery;
};

export function ResultsTable(props: ResultsTableProps) {
  const { onChange, onClose, query } = props;
  const {
    isLoading,
    metricsData,
    settings: { hasMetadata, fullMetaSearch, disableTextWrap },
    pagination: { pageNum, resultsPerPage },
    selectedTypes,
    searchedText,
  } = useMetricsModal();

  const slicedMetrics = useMemo(() => {
    let filteredMetrics = metricsData;
    if (selectedTypes.length > 0) {
      filteredMetrics = metricsData.filter((m: MetricData, idx) => {
        // Matches type
        const matchesSelectedType = selectedTypes.some((t) => {
          if (m.type && t.value) {
            return m.type.includes(t.value);
          }

          if (!m.type && t.value === 'no type') {
            return true;
          }

          return false;
        });

        // when a user filters for type, only return metrics with defined types
        return matchesSelectedType;
      });
    }

    return filteredMetrics.slice((pageNum - 1) * resultsPerPage, (pageNum - 1) * resultsPerPage + resultsPerPage);
  }, [metricsData, pageNum, resultsPerPage, selectedTypes]);

  const theme = useTheme2();
  const styles = getStyles(theme, disableTextWrap);

  function selectMetric(metric: MetricData) {
    if (metric.value) {
      onChange({ ...query, metric: metric.value });
      onClose();
    }
  }

  function metaRows(metric: MetricData) {
    if (fullMetaSearch && metric) {
      const searchWords = searchedText.split(' ');
      return (
        <>
          <td>{displayType(metric.type ?? '')}</td>
          <td>
            <Highlighter
              textToHighlight={metric.description ?? ''}
              searchWords={searchWords}
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
                <Trans i18nKey="grafana-prometheus.querybuilder.results-table.content-descriptive-type">
                  When creating a {{ descriptiveType }}, Prometheus exposes multiple series with the type counter.{' '}
                </Trans>
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

    if (!searchedText) {
      message = t(
        'grafana-prometheus.querybuilder.results-table.message-no-metrics-found',
        'There are no metrics found in the data source.'
      );
    }

    if (query.labels.length > 0) {
      message = t(
        'grafana-prometheus.querybuilder.results-table.message-expand-label-filters',
        'There are no metrics found. Try to expand your label filters.'
      );
    }

    if (searchedText || selectedTypes.length > 0) {
      message = t(
        'grafana-prometheus.querybuilder.results-table.message-expand-search',
        'There are no metrics found. Try to expand your search and filters.'
      );
    }

    return (
      <tr className={styles.noResults}>
        <td colSpan={3}>{message}</td>
      </tr>
    );
  }

  return (
    <table className={styles.table}>
      <thead className={styles.stickyHeader}>
        <tr>
          <th className={`${styles.nameWidth} ${styles.tableHeaderPadding}`}>
            <Trans i18nKey="grafana-prometheus.querybuilder.results-table.name">Name</Trans>
          </th>
          {hasMetadata && (
            <>
              <th className={`${styles.typeWidth} ${styles.tableHeaderPadding}`}>
                <Trans i18nKey="grafana-prometheus.querybuilder.results-table.type">Type</Trans>
              </th>
              <th className={`${styles.descriptionWidth} ${styles.tableHeaderPadding}`}>
                <Trans i18nKey="grafana-prometheus.querybuilder.results-table.description">Description</Trans>
              </th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        <>
          {slicedMetrics.length > 0 &&
            slicedMetrics.map((metric: MetricData, idx: number) => {
              return (
                <tr key={metric?.value ?? idx} className={styles.row} onClick={() => selectMetric(metric)}>
                  <td className={styles.nameOverflow}>
                    <Highlighter
                      textToHighlight={metric?.value ?? ''}
                      searchWords={searchedText.split(' ')}
                      autoEscape
                      highlightClassName={styles.matchHighLight}
                    />
                  </td>
                  {hasMetadata && metaRows(metric)}
                </tr>
              );
            })}
          {slicedMetrics.length === 0 && !isLoading && noMetricsMessages()}
        </>
      </tbody>
    </table>
  );
}

const getStyles = (theme: GrafanaTheme2, disableTextWrap: boolean) => {
  return {
    table: css({
      tableLayout: disableTextWrap ? undefined : 'fixed',
      borderRadius: theme.shape.radius.default,
      width: '100%',
      whiteSpace: disableTextWrap ? 'nowrap' : 'normal',
      td: {
        padding: theme.spacing(1),
      },
      'td,th': {
        minWidth: theme.spacing(3),
        borderBottom: `1px solid ${theme.colors.border.weak}`,
      },
    }),
    row: css({
      label: 'row',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      cursor: 'pointer',
      '&:last-child': {
        borderBottom: 0,
      },
      '&:hover': {
        backgroundColor: theme.colors.background.secondary,
      },
    }),
    tableHeaderPadding: css({
      padding: '8px',
    }),
    matchHighLight: css({
      background: 'inherit',
      color: theme.components.textHighlight.text,
      backgroundColor: theme.components.textHighlight.background,
    }),
    nameWidth: css({
      width: disableTextWrap ? undefined : '37.5%',
    }),
    nameOverflow: css({
      overflowWrap: disableTextWrap ? undefined : 'anywhere',
    }),
    typeWidth: css({
      width: disableTextWrap ? undefined : '15%',
    }),
    descriptionWidth: css({
      width: disableTextWrap ? undefined : '35%',
    }),
    stickyHeader: css({
      position: 'sticky',
      top: 0,
      backgroundColor: theme.colors.background.primary,
    }),
    noResults: css({
      textAlign: 'center',
      color: theme.colors.text.secondary,
    }),
    tooltipSpace: css({
      marginLeft: '4px',
    }),
  };
};
