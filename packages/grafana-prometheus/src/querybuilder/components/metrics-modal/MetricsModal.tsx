// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/MetricsModal.tsx
import { cx } from '@emotion/css';
import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import debounce from 'debounce-promise';
import { useCallback, useEffect, useMemo, useReducer } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
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
  placeholders,
  promTypes,
  setMetrics,
  tracking,
} from './state/helpers';
import {
  DEFAULT_RESULTS_PER_PAGE,
  initialState,
  MAXIMUM_RESULTS_PER_PAGE,
  MetricsModalMetadata,
  // stateSlice,
} from './state/state';
import { getStyles } from './styles';
import { MetricsData, PromFilterOption } from './types';
import { debouncedPromqlCompliantMatch } from './uFuzzy';

export type MetricsModalProps = {
  datasource: PrometheusDatasource;
  isOpen: boolean;
  query: PromVisualQuery;
  onClose: () => void;
  onChange: (query: PromVisualQuery) => void;
  initialMetrics: string[];
};

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
        debouncedPromqlCompliantMatch(Object.keys(state.metaHaystackDictionary), query, fuzzyMetaDispatch);
      } else {
        debouncedPromqlCompliantMatch(Object.keys(state.nameHaystackDictionary), query, fuzzyNameDispatch);
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
      title="Metrics explorer"
      onDismiss={onClose}
      aria-label="Browse metrics"
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
                data-testid={metricsModaltestIds.showAdditionalSettings}
                className={styles.noBorder}
              >
                Additional Settings
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
        {query.metric && <i className={styles.currentlySelected}>Currently selected: {query.metric}</i>}
        {query.labels.length > 0 && (
          <div className={styles.resultsDataFiltered}>
            <Icon name="info-circle" size="sm" />
            <div className={styles.resultsDataFilteredText}>
              &nbsp;These metrics have been pre-filtered by labels chosen in the label filters.
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
          Showing {state.filteredMetricCount} of {state.totalMetricCount} results
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
          <p className={styles.resultsPerPageLabel}># Results per page&nbsp;</p>
          <Input
            data-testid={metricsModaltestIds.resultsPerPage}
            value={calculateResultsPerPage(state.resultsPerPage, DEFAULT_RESULTS_PER_PAGE, MAXIMUM_RESULTS_PER_PAGE)}
            placeholder="results per page"
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

export const metricsModaltestIds = {
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

const stateSlice = createSlice({
  name: 'metrics-modal-state',
  initialState: initialState(),
  reducers: {
    filterMetricsBackend: (
      state,
      action: PayloadAction<{
        metrics: MetricsData;
        filteredMetricCount: number;
        isLoading: boolean;
      }>
    ) => {
      state.metrics = action.payload.metrics;
      state.filteredMetricCount = action.payload.filteredMetricCount;
      state.isLoading = action.payload.isLoading;
    },
    buildMetrics: (state, action: PayloadAction<MetricsModalMetadata>) => {
      state.isLoading = action.payload.isLoading;
      state.metrics = action.payload.metrics;
      state.hasMetadata = action.payload.hasMetadata;
      state.metaHaystackDictionary = action.payload.metaHaystackDictionary;
      state.nameHaystackDictionary = action.payload.nameHaystackDictionary;
      state.totalMetricCount = action.payload.totalMetricCount;
      state.filteredMetricCount = action.payload.filteredMetricCount;
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setFilteredMetricCount: (state, action: PayloadAction<number>) => {
      state.filteredMetricCount = action.payload;
    },
    setResultsPerPage: (state, action: PayloadAction<number>) => {
      state.resultsPerPage = action.payload;
    },
    setPageNum: (state, action: PayloadAction<number>) => {
      state.pageNum = action.payload;
    },
    setFuzzySearchQuery: (state, action: PayloadAction<string>) => {
      state.fuzzySearchQuery = action.payload;
      state.pageNum = 1;
    },
    setNameHaystack: (state, action: PayloadAction<string[][]>) => {
      state.nameHaystackOrder = action.payload[0];
      state.nameHaystackMatches = action.payload[1];
    },
    setMetaHaystack: (state, action: PayloadAction<string[][]>) => {
      state.metaHaystackOrder = action.payload[0];
      state.metaHaystackMatches = action.payload[1];
    },
    setFullMetaSearch: (state, action: PayloadAction<boolean>) => {
      state.fullMetaSearch = action.payload;
      state.pageNum = 1;
    },
    setIncludeNullMetadata: (state, action: PayloadAction<boolean>) => {
      state.includeNullMetadata = action.payload;
      state.pageNum = 1;
    },
    setSelectedTypes: (state, action: PayloadAction<Array<SelectableValue<string>>>) => {
      state.selectedTypes = action.payload;
      state.pageNum = 1;
    },
    setUseBackend: (state, action: PayloadAction<boolean>) => {
      state.useBackend = action.payload;
      state.fullMetaSearch = false;
      state.pageNum = 1;
    },
    setDisableTextWrap: (state) => {
      state.disableTextWrap = !state.disableTextWrap;
    },
    showAdditionalSettings: (state) => {
      state.showAdditionalSettings = !state.showAdditionalSettings;
    },
  },
});

// actions to update the state
export const {
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
  setDisableTextWrap,
  showAdditionalSettings,
  setFilteredMetricCount,
} = stateSlice.actions;
