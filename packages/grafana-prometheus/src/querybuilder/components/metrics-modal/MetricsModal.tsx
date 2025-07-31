// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/MetricsModal.tsx
import { cx } from '@emotion/css';

import { SelectableValue, TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Icon, Input, Modal, MultiSelect, Pagination, Spinner, useStyles2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../../datasource';
import { PromVisualQuery } from '../../types';

import { FeedbackLink } from './FeedbackLink';
import { MetricsModalContextProvider, useMetricsModal } from './MetricsModalContext';
import { ResultsTable } from './ResultsTable';
import { calculatePageList, getPlaceholders, getPromTypes } from './helpers';
import { getMetricsModalStyles } from './styles';
import { metricsModaltestIds } from './testIds';
import { PromFilterOption } from './types';

interface MetricsModalProps {
  datasource: PrometheusDatasource;
  timeRange: TimeRange;
  isOpen: boolean;
  query: PromVisualQuery;
  onClose: () => void;
  onChange: (query: PromVisualQuery) => void;
}

const MetricsModalContent = (props: MetricsModalProps) => {
  const { isOpen, onClose, onChange, query, timeRange } = props;

  const {
    isLoading,
    filteredMetricsData,
    debouncedBackendSearch,
    pagination,
    setPagination,
    selectedTypes,
    setSelectedTypes,
    searchedText,
    setSearchedText,
  } = useMetricsModal();

  const styles = useStyles2(getMetricsModalStyles);
  const placeholders = getPlaceholders();
  const promTypes = getPromTypes();

  const typeOptions: SelectableValue[] = promTypes.map((t: PromFilterOption) => {
    return {
      value: t.value,
      label: t.label,
      description: t.description,
    };
  });

  const searchCallback = (query: string, fullMetaSearchVal?: boolean) => {
    setSearchedText(query);
    debouncedBackendSearch(timeRange, query);
  };

  return (
    <Modal
      data-testid={metricsModaltestIds.metricModal}
      isOpen={isOpen}
      title={t('grafana-prometheus.querybuilder.metrics-modal.title-metrics-explorer', 'Metrics explorer')}
      onDismiss={onClose}
      aria-label={t('grafana-prometheus.querybuilder.metrics-modal.aria-label-browse-metrics', 'Browse metrics')}
      className={styles.modal}
    >
      <FeedbackLink feedbackUrl="https://forms.gle/DEMAJHoAMpe3e54CA" />
      <div
        className={styles.inputWrapper}
        data-testid={selectors.components.DataSource.Prometheus.queryEditor.builder.metricsExplorer}
      >
        <div className={cx(styles.inputItem, styles.inputItemFirst)}>
          <Input
            autoFocus={true}
            data-testid={metricsModaltestIds.searchMetric}
            placeholder={placeholders.browse}
            value={searchedText}
            onInput={(e) => {
              const value = e.currentTarget.value ?? '';
              setSearchedText(value);
              setPagination({ ...pagination, pageNum: 1 });
              searchCallback(value);
            }}
          />
        </div>
        <div className={styles.inputItem}>
          <MultiSelect
            data-testid={metricsModaltestIds.selectType}
            inputId="my-select"
            options={typeOptions}
            value={selectedTypes}
            placeholder={placeholders.filterType}
            onChange={setSelectedTypes}
          />
        </div>
        <div>
          <Spinner className={`${styles.loadingSpinner} ${isLoading ? styles.visible : ''}`} />
        </div>
      </div>
      <div className={styles.resultsData}>
        {query.metric && (
          <i className={styles.currentlySelected}>
            <Trans
              i18nKey="grafana-prometheus.querybuilder.metrics-modal.currently-selected"
              values={{ selected: query.metric }}
            >
              Currently selected: {'{{selected}}'}
            </Trans>
          </i>
        )}
        {query.labels.length > 0 && (
          <div className={styles.resultsDataFiltered}>
            <Icon name="info-circle" size="sm" />
            <div className={styles.resultsDataFilteredText}>
              &nbsp;
              <Trans i18nKey="grafana-prometheus.querybuilder.metrics-modal.metrics-pre-filtered">
                These metrics have been pre-filtered by labels chosen in the label filters.
              </Trans>
            </div>
          </div>
        )}
      </div>
      <div className={styles.results}>
        {filteredMetricsData && <ResultsTable onChange={onChange} onClose={onClose} query={query} />}
      </div>
      <div className={styles.resultsFooter}>
        <Pagination
          currentPage={pagination.pageNum ?? 1}
          numberOfPages={calculatePageList(filteredMetricsData, pagination.resultsPerPage).length}
          onNavigate={(val: number) => setPagination({ ...pagination, pageNum: val ?? 1 })}
        />
      </div>
    </Modal>
  );
};

export const MetricsModal = (props: MetricsModalProps) => {
  return (
    <MetricsModalContextProvider languageProvider={props.datasource.languageProvider}>
      <MetricsModalContent {...props} />
    </MetricsModalContextProvider>
  );
};
