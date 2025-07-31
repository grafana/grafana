// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/ResultsTable.tsx
import { ReactElement, useMemo } from 'react';
import Highlighter from 'react-highlight-words';

import { t, Trans } from '@grafana/i18n';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { docsTip } from '../../../configuration/shared/utils';
import { PromVisualQuery } from '../../types';

import { useMetricsModal } from './MetricsModalContext';
import { getResultsTableStyles } from './styles';
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
    filteredMetricsData,
    pagination: { pageNum, resultsPerPage },
    selectedTypes,
    searchedText,
  } = useMetricsModal();

  const slicedMetrics = useMemo(
    () => filteredMetricsData.slice((pageNum - 1) * resultsPerPage, (pageNum - 1) * resultsPerPage + resultsPerPage),
    [filteredMetricsData, pageNum, resultsPerPage]
  );

  const styles = useStyles2(getResultsTableStyles);

  function selectMetric(metric: MetricData) {
    if (metric.value) {
      onChange({ ...query, metric: metric.value });
      onClose();
    }
  }

  function metaRows(metric: MetricData) {
    return (
      <>
        <td>{displayType(metric.type ?? '')}</td>
        <td>
          <Highlighter
            textToHighlight={metric.description ?? ''}
            searchWords={[]}
            autoEscape
            highlightClassName={styles.matchHighLight}
          />
        </td>
      </>
    );
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
          <th className={`${styles.typeWidth} ${styles.tableHeaderPadding}`}>
            <Trans i18nKey="grafana-prometheus.querybuilder.results-table.type">Type</Trans>
          </th>
          <th className={`${styles.descriptionWidth} ${styles.tableHeaderPadding}`}>
            <Trans i18nKey="grafana-prometheus.querybuilder.results-table.description">Description</Trans>
          </th>
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
                  {metaRows(metric)}
                </tr>
              );
            })}
          {slicedMetrics.length === 0 && !isLoading && noMetricsMessages()}
        </>
      </tbody>
    </table>
  );
}
