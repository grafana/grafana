// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/MetricsModal.tsx
import { cx } from '@emotion/css';
import debounce from 'debounce-promise';
import { useCallback, useEffect, useMemo, useReducer } from 'react';

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
  useTheme2,
} from '@grafana/ui';

import { getDebounceTimeInMilliseconds } from '../../../caching';
import { METRIC_LABEL } from '../../../constants';
import { regexifyLabelValuesQueryString } from '../../parsingUtils';
import { formatPrometheusLabelFilters } from '../shared/formatter';

import { AdditionalSettings } from './AdditionalSettings';
import { FeedbackLink } from './FeedbackLink';
import { ResultsTable } from './ResultsTable';
import { metricsModaltestIds } from './shared/testIds';
import { MetricsModalProps } from './shared/types';
import {
  calculatePageList,
  calculateResultsPerPage,
  displayedMetrics,
  getPlaceholders,
  getPromTypes,
  setMetrics,
  tracking,
} from './state/helpers';
import {
  buildMetrics,
  DEFAULT_RESULTS_PER_PAGE,
  filterMetricsBackend,
  initialState,
  MAXIMUM_RESULTS_PER_PAGE,
  MetricsModalMetadata,
  setDisableTextWrap,
  setFullMetaSearch,
  setFuzzySearchQuery,
  setIncludeNullMetadata,
  setIsLoading,
  setMetaHaystack,
  setNameHaystack,
  setPageNum,
  setResultsPerPage,
  setSelectedTypes,
  setUseBackend,
  showAdditionalSettings,
  stateSlice,
} from './state/state';
import { getStyles } from './styles';
import { PromFilterOption } from './types';
import { debouncedFuzzySearch } from './uFuzzy';

export const MetricsModal = (props: MetricsModalProps) => {
  const { datasource, isOpen, onClose, onChange, query, initialMetrics, timeRange } = props;

  const [state, dispatch] = useReducer(stateSlice.reducer, initialState(query));

  const theme = useTheme2();
  const styles = getStyles(theme, state.disableTextWrap);
  const placeholders = getPlaceholders();
  const promTypes = getPromTypes();

  /**
   * loads metrics and metadata on opening modal and switching off useBackend
   */
  const updateMetricsMetadata = useCallback(async () => {
    // *** Loading Gif
    dispatch(setIsLoading(true));

    // Because Combobox in MetricsCombobox doesn't use the same lifecycle as Select to open the Metrics Explorer
    // it might not have loaded any metrics yet, so it instead passes in an async function to get the metrics
    const metrics = typeof initialMetrics === 'function' ? await initialMetrics() : initialMetrics;

    const data: MetricsModalMetadata = await setMetrics(datasource, query, metrics);
    dispatch(
      buildMetrics({
        isLoading: false,
        hasMetadata: data.hasMetadata,
        metrics: data.metrics,
        metaHaystackDictionary: data.metaHaystackDictionary,
        nameHaystackDictionary: data.nameHaystackDictionary,
        totalMetricCount: data.metrics.length,
        filteredMetricCount: data.metrics.length,
      })
    );
  }, [query, datasource, initialMetrics]);

  useEffect(() => {
    updateMetricsMetadata();
  }, [updateMetricsMetadata]);

  const typeOptions: SelectableValue[] = promTypes.map((t: PromFilterOption) => {
    return {
      value: t.value,
      label: t.label,
      description: t.description,
    };
  });

  /**
   * The backend debounced search
   */
  const debouncedBackendSearch = useMemo(
    () =>
      debounce(async (metricText: string) => {
        dispatch(setIsLoading(true));

        const queryString = regexifyLabelValuesQueryString(metricText);
        const filterArray = query.labels ? formatPrometheusLabelFilters(query.labels) : [];
        const match = `{__name__=~".*${queryString}"${filterArray ? filterArray.join('') : ''}}`;

        const results = await datasource.languageProvider.queryLabelValues(timeRange, METRIC_LABEL, match);

        const resultsOptions = results.map((result) => ({
          value: result,
        }));

        dispatch(
          filterMetricsBackend({
            metrics: resultsOptions,
            filteredMetricCount: resultsOptions.length,
            isLoading: false,
          })
        );
      }, getDebounceTimeInMilliseconds(datasource.cacheLevel)),
    [datasource.cacheLevel, datasource.languageProvider, query.labels, timeRange]
  );

  function fuzzyNameDispatch(haystackData: string[][]) {
    dispatch(setNameHaystack(haystackData));
  }

  function fuzzyMetaDispatch(haystackData: string[][]) {
    dispatch(setMetaHaystack(haystackData));
  }

  function searchCallback(query: string, fullMetaSearchVal: boolean) {
    if (state.useBackend && query === '') {
      // get all metrics data if a user erases everything in the input
      updateMetricsMetadata();
    } else if (state.useBackend) {
      debouncedBackendSearch(query);
    } else {
      // search either the names or all metadata
      // fuzzy search go!
      if (fullMetaSearchVal) {
        debouncedFuzzySearch(Object.keys(state.metaHaystackDictionary), query, fuzzyMetaDispatch);
      } else {
        debouncedFuzzySearch(Object.keys(state.nameHaystackDictionary), query, fuzzyNameDispatch);
      }
    }
  }

  /* Settings switches */
  const additionalSettings = (
    <AdditionalSettings
      state={state}
      onChangeFullMetaSearch={() => {
        const newVal = !state.fullMetaSearch;
        dispatch(setFullMetaSearch(newVal));
        onChange({ ...query, fullMetaSearch: newVal });
        searchCallback(state.fuzzySearchQuery, newVal);
      }}
      onChangeIncludeNullMetadata={() => {
        dispatch(setIncludeNullMetadata(!state.includeNullMetadata));
        onChange({ ...query, includeNullMetadata: !state.includeNullMetadata });
      }}
      onChangeDisableTextWrap={() => {
        dispatch(setDisableTextWrap());
        onChange({ ...query, disableTextWrap: !state.disableTextWrap });
        tracking('grafana_prom_metric_encycopedia_disable_text_wrap_interaction', state, '');
      }}
      onChangeUseBackend={() => {
        const newVal = !state.useBackend;
        dispatch(setUseBackend(newVal));
        onChange({ ...query, useBackend: newVal });
        if (newVal === false) {
          // rebuild the metrics metadata if we turn off useBackend
          updateMetricsMetadata();
        } else {
          // check if there is text in the browse search and update
          if (state.fuzzySearchQuery !== '') {
            debouncedBackendSearch(state.fuzzySearchQuery);
          }
          // otherwise wait for user typing
        }
      }}
    />
  );

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
            value={state.fuzzySearchQuery}
            onInput={(e) => {
              const value = e.currentTarget.value ?? '';
              dispatch(setFuzzySearchQuery(value));
              searchCallback(value, state.fullMetaSearch);
            }}
          />
        </div>
        {state.hasMetadata && (
          <div className={styles.inputItem}>
            <MultiSelect
              data-testid={metricsModaltestIds.selectType}
              inputId="my-select"
              options={typeOptions}
              value={state.selectedTypes}
              placeholder={placeholders.type}
              onChange={(v) => dispatch(setSelectedTypes(v))}
            />
          </div>
        )}
        <div>
          <Spinner className={`${styles.loadingSpinner} ${state.isLoading ? styles.visible : ''}`} />
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
                onClick={() => dispatch(showAdditionalSettings())}
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
                icon={state.showAdditionalSettings ? 'angle-up' : 'angle-down'}
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
        {state.metrics && (
          <ResultsTable
            metrics={displayedMetrics(state, dispatch)}
            onChange={onChange}
            onClose={onClose}
            query={query}
            state={state}
            disableTextWrap={state.disableTextWrap}
          />
        )}
      </div>
      <div className={styles.resultsFooter}>
        <div className={styles.resultsAmount}>
          <Trans
            i18nKey="grafana-prometheus.querybuilder.metrics-modal.results-amount"
            values={{ num: state.filteredMetricCount }}
            count={state.totalMetricCount}
          >
            Showing {'{{num}}'} of {'{{count}}'} results
          </Trans>
        </div>
        <Pagination
          currentPage={state.pageNum ?? 1}
          numberOfPages={calculatePageList(state).length}
          onNavigate={(val: number) => {
            const page = val ?? 1;
            dispatch(setPageNum(page));
          }}
        />
        <div className={styles.resultsPerPageWrapper}>
          <p className={styles.resultsPerPageLabel}>
            <Trans i18nKey="grafana-prometheus.querybuilder.metrics-modal.results-per-page">Results per page</Trans>
          </p>
          <Input
            data-testid={metricsModaltestIds.resultsPerPage}
            value={calculateResultsPerPage(state.resultsPerPage, DEFAULT_RESULTS_PER_PAGE, MAXIMUM_RESULTS_PER_PAGE)}
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

              dispatch(setResultsPerPage(value));
            }}
          />
        </div>
      </div>
    </Modal>
  );
};
