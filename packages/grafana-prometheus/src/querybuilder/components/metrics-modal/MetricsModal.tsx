// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/MetricsModal.tsx
import { cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import {
  Button,
  ButtonGroup,
  Icon,
  Input,
  Modal,
  MultiSelect,
  Pagination,
  Spinner,
  Toggletip,
  useStyles2,
} from '@grafana/ui';

import { PrometheusDatasource } from '../../../datasource';
import { PromVisualQuery } from '../../types';

import { AdditionalSettings } from './AdditionalSettings';
import { FeedbackLink } from './FeedbackLink';
import {
  DEFAULT_RESULTS_PER_PAGE,
  MAXIMUM_RESULTS_PER_PAGE,
  MetricsModalContextProvider,
  useMetricsModal,
} from './MetricsModalContext';
import { ResultsTable } from './ResultsTable';
import { calculatePageList, calculateResultsPerPage, getPlaceholders, getPromTypes } from './state/helpers';
import { getStyles } from './styles';
import { metricsModaltestIds } from './testIds';
import { PromFilterOption } from './types';

interface MetricsModalProps {
  datasource: PrometheusDatasource;
  isOpen: boolean;
  query: PromVisualQuery;
  onClose: () => void;
  onChange: (query: PromVisualQuery) => void;
}

const MetricsModalContent = (props: MetricsModalProps) => {
  const { isOpen, onClose, onChange, query } = props;

  const [showAdditionalSettings, setShowAdditionalSettings] = useState(false);
  const {
    isLoading,
    metricsData,
    settings: { hasMetadata, disableTextWrap },
    pagination,
    setPagination,
    selectedTypes,
    setSelectedTypes,
    textSearch,
    setTextSearch,
  } = useMetricsModal();

  const styles = useStyles2(getStyles, disableTextWrap);
  const placeholders = getPlaceholders();
  const promTypes = getPromTypes();

  /**
   * loads metrics and metadata on opening modal and switching off useBackend
   */
  // const updateMetricsMetadata = useCallback(async () => {
  //   // *** Loading Gif
  //   // dispatch(setIsLoading(true));
  //   setIsLoading(true);
  //
  //   // Because Combobox in MetricsCombobox doesn't use the same lifecycle as Select to open the Metrics Explorer
  //   // it might not have loaded any metrics yet, so it instead passes in an async function to get the metrics
  //   const metrics = typeof initialMetrics === 'function' ? await initialMetrics() : initialMetrics;
  //
  //   const data: MetricsModalMetadata = await setMetrics(datasource, query, metrics);
  //   setIsLoading(false);
  //   dispatch(
  //     buildMetrics({
  //       // isLoading: false,
  //       hasMetadata: data.hasMetadata,
  //       metrics: data.metrics,
  //       metaHaystackDictionary: data.metaHaystackDictionary,
  //       nameHaystackDictionary: data.nameHaystackDictionary,
  //       totalMetricCount: data.metrics.length,
  //       filteredMetricCount: data.metrics.length,
  //     })
  //   );
  // }, [setIsLoading, initialMetrics, datasource, query]);

  // useEffect(() => {
  //   updateMetricsMetadata();
  // }, [updateMetricsMetadata]);

  const typeOptions: SelectableValue[] = promTypes.map((t: PromFilterOption) => {
    return {
      value: t.value,
      label: t.label,
      description: t.description,
    };
  });

  /**
   * The backend debounced search
   * FIXME we might need this
   */
  // const debouncedBackendSearch = useMemo(
  //   () =>
  //     debounce(async (metricText: string) => {
  //       setIsLoading(true);
  //
  //       const queryString = regexifyLabelValuesQueryString(metricText);
  //       const filterArray = query.labels ? formatPrometheusLabelFilters(query.labels) : [];
  //       const match = `{__name__=~".*${queryString}"${filterArray ? filterArray.join('') : ''}}`;
  //
  //       const results = await datasource.languageProvider.queryLabelValues(timeRange, METRIC_LABEL, match);
  //
  //       const resultsOptions = results.map((result) => ({
  //         value: result,
  //       }));
  //
  //       dispatch(
  //         filterMetricsBackend({
  //           metrics: resultsOptions,
  //           filteredMetricCount: resultsOptions.length,
  //           isLoading: false,
  //         })
  //       );
  //     }, getDebounceTimeInMilliseconds(datasource.cacheLevel)),
  //   [datasource.cacheLevel, datasource.languageProvider, query.labels, setIsLoading, timeRange]
  // );

  // function fuzzyNameDispatch(haystackData: string[][]) {
  //   dispatch(setNameHaystack(haystackData));
  // }
  //
  // function fuzzyMetaDispatch(haystackData: string[][]) {
  //   dispatch(setMetaHaystack(haystackData));
  // }

  function searchCallback(query: string, fullMetaSearchVal?: boolean) {
    // if (state.useBackend && query === '') {
    //   // get all metrics data if a user erases everything in the input
    //   updateMetricsMetadata();
    // } else if (state.useBackend) {
    //   debouncedBackendSearch(query);
    // } else {
    //   // search either the names or all metadata
    //   // fuzzy search go!
    //   if (fullMetaSearchVal) {
    //     debouncedFuzzySearch(Object.keys(state.metaHaystackDictionary), query, fuzzyMetaDispatch);
    //   } else {
    //     debouncedFuzzySearch(Object.keys(state.nameHaystackDictionary), query, fuzzyNameDispatch);
    //   }
    // }

    console.log('make call to backend with: ', { query, fullMetaSearchVal });
  }

  /* Settings switches */
  const additionalSettings = useMemo(() => <AdditionalSettings />, []);

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
            value={textSearch.fuzzySearchQuery}
            onInput={(e) => {
              const value = e.currentTarget.value ?? '';
              setTextSearch({ ...textSearch, fuzzySearchQuery: value });
              setPagination({ ...pagination, pageNum: 1 });
              searchCallback(value);
            }}
          />
        </div>
        {hasMetadata && (
          <div className={styles.inputItem}>
            <MultiSelect
              data-testid={metricsModaltestIds.selectType}
              inputId="my-select"
              options={typeOptions}
              value={selectedTypes}
              placeholder={placeholders.filterType}
              onChange={(v) => setSelectedTypes(v)}
            />
          </div>
        )}
        <div>
          <Spinner className={`${styles.loadingSpinner} ${isLoading ? styles.visible : ''}`} />
        </div>
        <div className={styles.inputItem}>
          <Toggletip
            aria-label={t(
              'grafana-prometheus.querybuilder.metrics-modal.aria-label-additional-settings',
              'Additional settings'
            )}
            content={additionalSettings}
            placement="bottom-end"
            closeButton={false}
          >
            <ButtonGroup className={styles.settingsBtn}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowAdditionalSettings(!showAdditionalSettings)}
                data-testid={metricsModaltestIds.showAdditionalSettings}
                className={styles.noBorder}
              >
                <Trans i18nKey="grafana-prometheus.querybuilder.metrics-modal.additional-settings">
                  Additional Settings
                </Trans>
              </Button>
              <Button
                className={styles.noBorder}
                variant="secondary"
                icon={showAdditionalSettings ? 'angle-up' : 'angle-down'}
              />
            </ButtonGroup>
          </Toggletip>
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
        {metricsData && <ResultsTable onChange={onChange} onClose={onClose} query={query} />}
      </div>
      <div className={styles.resultsFooter}>
        {/*<div className={styles.resultsAmount}>
          <Trans
            i18nKey="grafana-prometheus.querybuilder.metrics-modal.results-amount"
            values={{ num: state.filteredMetricCount }}
            count={state.totalMetricCount}
          >
            Showing {'{{num}}'} of {'{{count}}'} results
          </Trans>
        </div>*/}
        <Pagination
          currentPage={pagination.pageNum ?? 1}
          numberOfPages={calculatePageList(metricsData, pagination.resultsPerPage).length}
          onNavigate={(val: number) => setPagination({ ...pagination, pageNum: val ?? 1 })}
        />
        <div className={styles.resultsPerPageWrapper}>
          <p className={styles.resultsPerPageLabel}>
            <Trans i18nKey="grafana-prometheus.querybuilder.metrics-modal.results-per-page">Results per page</Trans>
          </p>
          <Input
            data-testid={metricsModaltestIds.resultsPerPage}
            value={calculateResultsPerPage(
              pagination.resultsPerPage,
              DEFAULT_RESULTS_PER_PAGE,
              MAXIMUM_RESULTS_PER_PAGE
            )}
            placeholder={t(
              'grafana-prometheus.querybuilder.metrics-modal.placeholder-results-per-page',
              'results per page'
            )}
            width={10}
            title={'The maximum results per page is ' + MAXIMUM_RESULTS_PER_PAGE}
            type="number"
            onInput={(e) => {
              const value = +e.currentTarget.value;

              if (isNaN(value) || value >= MAXIMUM_RESULTS_PER_PAGE) {
                return;
              }

              setPagination({ ...pagination, resultsPerPage: value });
            }}
          />
        </div>
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
