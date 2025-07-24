// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/ResultsTable.tsx
import { css } from '@emotion/css';
import { ReactElement } from 'react';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Icon, Tooltip, useTheme2 } from '@grafana/ui';

import { docsTip } from '../../../configuration/shared/utils';
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
  disableTextWrap: boolean;
};

export function ResultsTable(props: ResultsTableProps) {
  const { metrics, onChange, onClose, query, state, disableTextWrap } = props;

  const theme = useTheme2();
  const styles = getStyles(theme, disableTextWrap);

  function selectMetric(metric: MetricData) {
    if (metric.value) {
      onChange({ ...query, metric: metric.value });
      tracking('grafana_prom_metric_encycopedia_tracking', state, metric.value);
      onClose();
    }
  }

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

    if (!state.fuzzySearchQuery) {
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

    if (state.fuzzySearchQuery || state.selectedTypes.length > 0) {
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
    <table className={styles.table}>
      <thead className={styles.stickyHeader}>
        <tr>
          <th className={`${styles.nameWidth} ${styles.tableHeaderPadding}`}>
            <Trans i18nKey="grafana-prometheus.querybuilder.results-table.name">Name</Trans>
          </th>
          {state.hasMetadata && (
            <>
              <th className={`${styles.typeWidth} ${styles.tableHeaderPadding}`}>
                <Trans i18nKey="grafana-prometheus.querybuilder.results-table.type">Type</Trans>
              </th>
              <th className={`${styles.descriptionWidth} ${styles.tableHeaderPadding}`}>
                <Trans i18nKey="grafana-prometheus.querybuilder.results-table.description">Description</Trans>
              </th>
            </>
          )}
          <th className={styles.selectButtonWidth}> </th>
        </tr>
      </thead>
      <tbody>
        <>
          {metrics.length > 0 &&
            metrics.map((metric: MetricData, idx: number) => {
              return (
                <tr key={metric?.value ?? idx} className={styles.row}>
                  <td className={styles.nameOverflow}>
                    <Highlighter
                      textToHighlight={metric?.value ?? ''}
                      searchWords={textHighlight(state)}
                      autoEscape
                      highlightClassName={styles.matchHighLight}
                    />
                  </td>
                  {state.hasMetadata && metaRows(metric)}
                  <td>
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={() => selectMetric(metric)}
                      className={styles.centerButton}
                    >
                      <Trans i18nKey="grafana-prometheus.querybuilder.results-table.select">Select</Trans>
                    </Button>
                  </td>
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
      '&:last-child': {
        borderBottom: 0,
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
    selectButtonWidth: css({
      width: disableTextWrap ? undefined : '12.5%',
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
    centerButton: css({
      display: 'block',
      margin: 'auto',
      border: 'none',
    }),
  };
};
