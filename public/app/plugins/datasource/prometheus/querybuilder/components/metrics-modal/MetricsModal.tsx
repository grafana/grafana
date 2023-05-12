import { cx } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';

import { SelectableValue } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import {
  InlineField,
  Input,
  Modal,
  MultiSelect,
  Spinner,
  useTheme2,
  Pagination,
  Button,
  Toggletip,
  ButtonGroup,
} from '@grafana/ui';

import { PrometheusDatasource } from '../../../datasource';
import { PromVisualQuery } from '../../types';

import { AdditionalSettings } from './AdditionalSettings';
import { FeedbackLink } from './FeedbackLink';
import { ResultsTable } from './ResultsTable';
import {
  calculatePageList,
  calculateResultsPerPage,
  displayedMetrics,
  getBackendSearchMetrics,
  setMetrics,
  placeholders,
  promTypes,
} from './state/helpers';
import {
  DEFAULT_RESULTS_PER_PAGE,
  initialState,
  MAXIMUM_RESULTS_PER_PAGE,
  MetricsModalMetadata,
  stateSlice,
} from './state/state';
import { getStyles } from './styles';
import { PromFilterOption } from './types';
import { debouncedFuzzySearch } from './uFuzzy';

export type MetricsModalProps = {
  datasource: PrometheusDatasource;
  isOpen: boolean;
  query: PromVisualQuery;
  onClose: () => void;
  onChange: (query: PromVisualQuery) => void;
  initialMetrics: string[];
};

// actions to update the state
const {
  setIsLoading,
  buildMetrics,
  filterMetricsBackend,
  setResultsPerPage,
  setPageNum,
  setFuzzySearchQuery,
  setNameHaystack,
  setMetaHaystack,
  setFullMetaSearch,
  setIncludeNullMetadata,
  setSelectedTypes,
  setUseBackend,
  setSelectedIdx,
  setDisableTextWrap,
  showAdditionalSettings,
} = stateSlice.actions;

export const MetricsModal = (props: MetricsModalProps) => {
  const { datasource, isOpen, onClose, onChange, query, initialMetrics } = props;

  const [state, dispatch] = useReducer(stateSlice.reducer, initialState(query));

  const theme = useTheme2();
  const styles = getStyles(theme, state.disableTextWrap);

  /**
   * loads metrics and metadata on opening modal and switching off useBackend
   */
  const updateMetricsMetadata = useCallback(async () => {
    // *** Loading Gif
    dispatch(setIsLoading(true));

    const data: MetricsModalMetadata = await setMetrics(datasource, query, initialMetrics);

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
      label: t.value,
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

        const metrics = await getBackendSearchMetrics(metricText, query.labels, datasource);

        dispatch(
          filterMetricsBackend({
            metrics: metrics,
            filteredMetricCount: metrics.length,
            isLoading: false,
          })
        );
      }, datasource.getDebounceTimeInMilliseconds()),
    [datasource, query]
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

  function keyFunction(e: React.KeyboardEvent<HTMLElement>) {
    if (e.code === 'ArrowDown' && state.selectedIdx < state.resultsPerPage - 1) {
      dispatch(setSelectedIdx(state.selectedIdx + 1));
    } else if (e.code === 'ArrowUp' && state.selectedIdx > 0) {
      dispatch(setSelectedIdx(state.selectedIdx - 1));
    } else if (e.code === 'Enter') {
      const metric = displayedMetrics(state, dispatch)[state.selectedIdx];

      onChange({ ...query, metric: metric.value });
      reportInteraction('grafana_prom_metric_encycopedia_tracking', {
        metric: metric.value,
        hasMetadata: state.hasMetadata,
        totalMetricCount: state.totalMetricCount,
        fuzzySearchQuery: state.fuzzySearchQuery,
        fullMetaSearch: state.fullMetaSearch,
        selectedTypes: state.selectedTypes,
      });
      onClose();
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
      data-testid={testIds.metricModal}
      isOpen={isOpen}
      title="Browse metrics"
      onDismiss={onClose}
      aria-label="Browse metrics"
      className={styles.modal}
    >
      <FeedbackLink feedbackUrl="https://forms.gle/DEMAJHoAMpe3e54CA" />
      <div className={styles.inputWrapper}>
        <div className={cx(styles.inputItem, styles.inputItemFirst)}>
          <Input
            autoFocus={true}
            data-testid={testIds.searchMetric}
            placeholder={placeholders.browse}
            value={state.fuzzySearchQuery}
            onInput={(e) => {
              const value = e.currentTarget.value ?? '';
              dispatch(setFuzzySearchQuery(value));
              searchCallback(value, state.fullMetaSearch);
            }}
            onKeyDown={(e) => {
              keyFunction(e);
            }}
          />
        </div>
        <div>
          <Spinner className={`${styles.loadingSpinner} ${state.isLoading ? styles.visible : ''}`} />
        </div>
        {state.hasMetadata && (
          <div className={styles.inputItem}>
            <MultiSelect
              data-testid={testIds.selectType}
              inputId="my-select"
              options={typeOptions}
              value={state.selectedTypes}
              placeholder={placeholders.type}
              onChange={(v) => dispatch(setSelectedTypes(v))}
            />
          </div>
        )}
        <div className={styles.inputItem}>
          <Toggletip
            aria-label="Additional settings"
            content={additionalSettings}
            placement="bottom-end"
            closeButton={false}
          >
            <ButtonGroup className={styles.settingsBtn}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => dispatch(showAdditionalSettings())}
                data-testid={testIds.showAdditionalSettings}
              >
                Additional Settings
              </Button>
              <Button variant="secondary" icon={state.showAdditionalSettings ? 'angle-up' : 'angle-down'} />
            </ButtonGroup>
          </Toggletip>
        </div>
      </div>
      <div className={styles.resultsData}>
        {query.labels.length > 0 && (
          <p className={styles.resultsDataFiltered}>
            These metrics have been pre-filtered by labels chosen in the label filters.
          </p>
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
            selectedIdx={state.selectedIdx}
            disableTextWrap={state.disableTextWrap}
          />
        )}
      </div>

      <div className={styles.pageSettingsWrapper}>
        <div className={styles.pageSettings}>
          <div className={styles.resultsAmount}>
            Showing {state.filteredMetricCount} of {state.totalMetricCount} results
          </div>
          <InlineField
            label="# results per page"
            tooltip={'The maximum results per page is ' + MAXIMUM_RESULTS_PER_PAGE}
            labelWidth={20}
          >
            <Input
              data-testid={testIds.resultsPerPage}
              value={calculateResultsPerPage(state.resultsPerPage, DEFAULT_RESULTS_PER_PAGE, MAXIMUM_RESULTS_PER_PAGE)}
              placeholder="results per page"
              width={20}
              onInput={(e) => {
                const value = +e.currentTarget.value;

                if (isNaN(value)) {
                  return;
                }

                dispatch(setResultsPerPage(value));
              }}
            />
          </InlineField>
          <Pagination
            currentPage={state.pageNum ?? 1}
            numberOfPages={calculatePageList(state).length}
            onNavigate={(val: number) => {
              const page = val ?? 1;
              dispatch(setPageNum(page));
            }}
          />
        </div>
      </div>
    </Modal>
  );
};

export const testIds = {
  metricModal: 'metric-modal',
  searchMetric: 'search-metric',
  searchWithMetadata: 'search-with-metadata',
  selectType: 'select-type',
  metricCard: 'metric-card',
  useMetric: 'use-metric',
  searchPage: 'search-page',
  resultsPerPage: 'results-per-page',
  setUseBackend: 'set-use-backend',
  showAdditionalSettings: 'show-additional-settings',
};
