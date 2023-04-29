import { cx } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { InlineField, Switch, Input, Modal, MultiSelect, Spinner, useTheme2, Pagination, Button } from '@grafana/ui';

import { PrometheusDatasource } from '../../../datasource';
import { PromVisualQuery } from '../../types';

import { FeedbackLink } from './FeedbackLink';
import { LetterSearch } from './LetterSearch';
import { ResultsTable } from './ResultsTable';
import {
  calculatePageList,
  calculateResultsPerPage,
  displayedMetrics,
  filterMetrics,
  getBackendSearchMetrics,
  getMetadata,
  placeholders,
  promTypes,
} from './state/helpers';
import {
  DEFAULT_RESULTS_PER_PAGE,
  initialState,
  MAXIMUM_RESULTS_PER_PAGE,
  MetricsModalReducer,
  MetricsModalMetadata,
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
};

export const MetricsModal = (props: MetricsModalProps) => {
  const { datasource, isOpen, onClose, onChange, query } = props;

  const [state, dispatch] = useReducer(MetricsModalReducer, initialState());

  const theme = useTheme2();
  const styles = getStyles(theme, state.disableTextWrap);

  /**
   * loads metrics and metadata on opening modal and switching off useBackend
   */
  const updateMetricsMetadata = useCallback(async () => {
    // *** Loading Gif
    dispatch({
      type: 'setIsLoading',
      payload: true,
    });

    const data: MetricsModalMetadata = await getMetadata(datasource, query);

    dispatch({
      type: 'setMetadata',
      payload: {
        isLoading: false,
        hasMetadata: data.hasMetadata,
        metrics: data.metrics,
        metaHaystackDictionary: data.metaHaystackDictionary,
        nameHaystackDictionary: data.nameHaystackDictionary,
        totalMetricCount: data.metrics.length,
        filteredMetricCount: data.metrics.length,
      },
    });
  }, [query, datasource]);

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
        dispatch({
          type: 'setIsLoading',
          payload: true,
        });

        const metrics = await getBackendSearchMetrics(metricText, query.labels, datasource);

        dispatch({
          type: 'filterMetricsBackend',
          payload: {
            metrics: metrics,
            filteredMetricCount: metrics.length,
            isLoading: false,
          },
        });
      }, datasource.getDebounceTimeInMilliseconds()),
    [datasource, query]
  );

  function fuzzySearchCallback(query: string, fullMetaSearchVal: boolean) {
    if (state.useBackend && query === '') {
      // get all metrics data if a user erases everything in the input
      updateMetricsMetadata();
    } else if (state.useBackend) {
      debouncedBackendSearch(query);
    } else {
      // search either the names or all metadata
      // fuzzy search go!
      if (fullMetaSearchVal) {
        debouncedFuzzySearch(Object.keys(state.metaHaystackDictionary), query, 'setMetaHaystack', dispatch);
      } else {
        debouncedFuzzySearch(Object.keys(state.nameHaystackDictionary), query, 'setNameHaystack', dispatch);
      }
    }
  }

  function keyFunction(e: React.KeyboardEvent<HTMLElement>) {
    if (e.code === 'ArrowDown' && state.selectedIdx < state.resultsPerPage - 1) {
      dispatch({ type: 'setSelectedIdx', payload: state.selectedIdx + 1 });
    } else if (e.code === 'ArrowUp' && state.selectedIdx > 0) {
      dispatch({ type: 'setSelectedIdx', payload: state.selectedIdx - 1 });
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
        letterSearch: state.letterSearch,
      });
      onClose();
    }
  }

  return (
    <Modal
      data-testid={testIds.metricModal}
      isOpen={isOpen}
      title="Browse metrics"
      onDismiss={onClose}
      aria-label="Browse metrics"
      className={styles.modal}
    >
      <div className={styles.inputWrapper}>
        <div className={cx(styles.inputItem, styles.inputItemFirst)}>
          <EditorField label="Search metrics">
            <Input
              autoFocus={true}
              data-testid={testIds.searchMetric}
              placeholder={placeholders.browse}
              value={state.fuzzySearchQuery}
              onInput={(e) => {
                const value = e.currentTarget.value ?? '';
                dispatch({
                  type: 'setFuzzySearchQuery',
                  payload: value,
                });

                fuzzySearchCallback(value, state.fullMetaSearch);
              }}
              onKeyDown={(e) => {
                keyFunction(e);
              }}
            />
          </EditorField>
        </div>
        <div className={styles.inputItem}>
          <EditorField label="Filter by type">
            <MultiSelect
              data-testid={testIds.selectType}
              inputId="my-select"
              options={typeOptions}
              value={state.selectedTypes}
              disabled={!state.hasMetadata || state.useBackend}
              placeholder={placeholders.type}
              onChange={(v) => {
                // *** Filter by type
                // *** always include metrics without metadata but label it as unknown type
                // Consider tabs select instead of actual select or multi select
                dispatch({
                  type: 'setSelectedTypes',
                  payload: v,
                });
              }}
            />
          </EditorField>
        </div>
      </div>
      {/* <h4 className={styles.resultsHeading}>Results</h4> */}
      <div className={styles.resultsData}>
        <div className={styles.resultsDataCount}>
          Showing {state.filteredMetricCount} of {state.totalMetricCount} results.{' '}
          <Spinner className={`${styles.loadingSpinner} ${state.isLoading ? styles.visible : ''}`} />
          <div className={styles.selectWrapper}>
            <div className={styles.alphabetRow}>
              <LetterSearch
                filteredMetrics={filterMetrics(state, true)}
                disableTextWrap={state.disableTextWrap}
                updateLetterSearch={(letter: string) => {
                  if (state.letterSearch === letter) {
                    dispatch({
                      type: 'setLetterSearch',
                      payload: '',
                    });
                  } else {
                    dispatch({
                      type: 'setLetterSearch',
                      payload: letter,
                    });
                  }
                }}
                letterSearch={state.letterSearch}
              />
              <Button
                variant="secondary"
                fill="text"
                size="sm"
                onClick={() => dispatch({ type: 'showAdditionalSettings', payload: null })}
                onKeyDown={(e) => {
                  keyFunction(e);
                }}
                data-testid={testIds.showAdditionalSettings}
              >
                Additional Settings
              </Button>
            </div>
            {state.showAdditionalSettings && (
              <>
                <div className={styles.selectItem}>
                  <Switch
                    data-testid={testIds.searchWithMetadata}
                    value={state.fullMetaSearch}
                    disabled={state.useBackend || !state.hasMetadata}
                    onChange={() => {
                      const newVal = !state.fullMetaSearch;
                      dispatch({
                        type: 'setFullMetaSearch',
                        payload: newVal,
                      });

                      fuzzySearchCallback(state.fuzzySearchQuery, newVal);
                    }}
                    onKeyDown={(e) => {
                      keyFunction(e);
                    }}
                  />
                  <p className={styles.selectItemLabel}>{placeholders.metadataSearchSwitch}</p>
                </div>
                <div className={styles.selectItem}>
                  <Switch
                    value={state.excludeNullMetadata}
                    disabled={state.useBackend || !state.hasMetadata}
                    onChange={() => {
                      dispatch({
                        type: 'setExcludeNullMetadata',
                        payload: !state.excludeNullMetadata,
                      });
                    }}
                    onKeyDown={(e) => {
                      keyFunction(e);
                    }}
                  />
                  <p className={styles.selectItemLabel}>{placeholders.excludeNoMetadata}</p>
                </div>
                <div className={styles.selectItem}>
                  <Switch
                    value={state.disableTextWrap}
                    onChange={() => dispatch({ type: 'setDisableTextWrap', payload: null })}
                    onKeyDown={(e) => {
                      keyFunction(e);
                    }}
                  />
                  <p className={styles.selectItemLabel}>Disable text wrap</p>
                </div>
                <div className={styles.selectItem}>
                  <Switch
                    data-testid={testIds.setUseBackend}
                    value={state.useBackend}
                    onChange={() => {
                      const newVal = !state.useBackend;
                      dispatch({
                        type: 'setUseBackend',
                        payload: newVal,
                      });
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
                    onKeyDown={(e) => {
                      keyFunction(e);
                    }}
                  />
                  <p className={styles.selectItemLabel}>{placeholders.setUseBackend}</p>
                </div>
              </>
            )}
          </div>
        </div>
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

                dispatch({
                  type: 'setResultsPerPage',
                  payload: value,
                });
              }}
            />
          </InlineField>
          <Pagination
            currentPage={state.pageNum ?? 1}
            numberOfPages={calculatePageList(state).length}
            onNavigate={(val: number) =>
              dispatch({
                type: 'setPageNum',
                payload: val ?? 1,
              })
            }
          />
        </div>
        <FeedbackLink feedbackUrl="https://forms.gle/DEMAJHoAMpe3e54CA" />
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
