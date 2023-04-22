import { cx } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import {
  Button,
  CellProps,
  Column,
  InlineField,
  Switch,
  Input,
  InteractiveTable,
  Modal,
  MultiSelect,
  Select,
  Spinner,
  useTheme2,
} from '@grafana/ui';

import { PrometheusDatasource } from '../../../datasource';
import { PromVisualQuery } from '../../types';
import { FeedbackLink } from '.././FeedbackLink';

import { LetterSearch } from './LetterSearch';
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
  MetricEncyclopediaReducer,
} from './state/state';
import { MetricEncyclopediaMetadata } from './state/types';
import { getStyles } from './styles';
import { PromFilterOption, MetricsData, MetricData } from './types';
import { debouncedFuzzySearch } from './uFuzzy';

export type MetricEncyclopediaProps = {
  datasource: PrometheusDatasource;
  isOpen: boolean;
  query: PromVisualQuery;
  onClose: () => void;
  onChange: (query: PromVisualQuery) => void;
};

export const MetricEncyclopediaModal = (props: MetricEncyclopediaProps) => {
  const { datasource, isOpen, onClose, onChange, query } = props;

  const [state, dispatch] = useReducer(MetricEncyclopediaReducer, initialState);

  const theme = useTheme2();
  const styles = getStyles(theme, state.disableTextWrap);

  /**
   * loads metrics and metadata on opening and switching off useBackend
   */
  const updateMetricsMetadata = useCallback(async () => {
    // *** Loading Gif
    dispatch({
      type: 'setIsLoading',
      payload: true,
    });

    const data: MetricEncyclopediaMetadata = await getMetadata(datasource, query);

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

  const ButtonCell = ({
    row: {
      original: { value },
    },
  }: CellProps<MetricData, void>) => {
    return (
      <Button
        size="sm"
        variant={'secondary'}
        fill={'solid'}
        aria-label="use this metric button"
        data-testid={testIds.useMetric}
        onClick={() => {
          onChange({ ...query, metric: value });
          reportInteraction('grafana_prom_metric_encycopedia_tracking', {
            metric: value,
            hasMetadata: state.hasMetadata,
            totalMetricCount: state.totalMetricCount,
            fuzzySearchQuery: state.fuzzySearchQuery,
            fullMetaSearch: state.fullMetaSearch,
            selectedTypes: state.selectedTypes,
            letterSearch: state.letterSearch,
          });
          onClose();
        }}
      >
        Use this metric
      </Button>
    );
  };

  function tableResults(metrics: MetricsData) {
    const tableData: MetricsData = metrics;

    const columns: Array<Column<MetricData>> = [
      { id: '', header: 'Select', cell: ButtonCell },
      { id: 'value', header: 'Name' },
      { id: 'type', header: 'Type' },
      { id: 'description', header: 'Description' },
    ];

    return <InteractiveTable className={styles.table} columns={columns} data={tableData} getRowId={(r) => r.value} />;
  }

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
        debouncedFuzzySearch(Object.keys(state.metaHaystackDictionary), query, 'setMetaHaystackOrder', dispatch);
      } else {
        debouncedFuzzySearch(Object.keys(state.nameHaystackDictionary), query, 'setNameHaystackOrder', dispatch);
      }
    }
  }

  return (
    <Modal
      data-testid={testIds.metricModal}
      isOpen={isOpen}
      title="Browse metrics"
      onDismiss={onClose}
      aria-label="Metric Encyclopedia"
      className={styles.modal}
    >
      <div className={styles.inputWrapper}>
        <div className={cx(styles.inputItem, styles.inputItemFirst)}>
          <EditorField label="Search metrics">
            <Input
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
        {true && (
          <div className={styles.inputItem}>
            <EditorField label="Select template variables">
              <Select
                inputId="my-select"
                options={datasource.getVariables().map((v: string) => {
                  return {
                    value: v,
                    label: v,
                  };
                })}
                value={''}
                placeholder={placeholders.variables}
                onChange={(v) => {
                  const value: string = v.value ?? '';
                  onChange({ ...query, metric: value });
                  onClose();
                }}
              />
            </EditorField>
          </div>
        )}
      </div>

      <div className={styles.selectWrapper}>
        <EditorField label="Search Settings">
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
              />
              <p className={styles.selectItemLabel}>{placeholders.metadataSearchSwitch}</p>
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
              />
              <p className={styles.selectItemLabel}>{placeholders.setUseBackend}</p>
            </div>
          </>
        </EditorField>
      </div>
      <h4 className={styles.resultsHeading}>Results</h4>
      <div className={styles.resultsData}>
        <div className={styles.resultsDataCount}>
          Showing {state.filteredMetricCount} of {state.totalMetricCount} total metrics.{' '}
          {state.isLoading && <Spinner className={styles.loadingSpinner} />}
        </div>
        {query.labels.length > 0 && (
          <p className={styles.resultsDataFiltered}>
            These metrics have been pre-filtered by labels chosen in the label filters.
          </p>
        )}
      </div>

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
        <div className={styles.alphabetRowToggles}>
          <div className={styles.selectItem}>
            <Switch
              value={state.disableTextWrap}
              onChange={() => dispatch({ type: 'setDisableTextWrap', payload: null })}
            />
            <p className={styles.selectItemLabel}>Disable text wrap</p>
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
            />
            <p className={styles.selectItemLabel}>{placeholders.excludeNoMetadata}</p>
          </div>
        </div>
      </div>

      <div className={styles.results}>{state.metrics && tableResults(displayedMetrics(state, dispatch))}</div>

      <div className={styles.pageSettingsWrapper}>
        <div className={styles.pageSettings}>
          <InlineField label="Select page" labelWidth={20} className="query-keyword">
            <Select
              data-testid={testIds.searchPage}
              options={calculatePageList(state).map((p) => {
                return { value: p, label: '' + p };
              })}
              value={state.pageNum ?? 1}
              placeholder="select page"
              width={20}
              onChange={(e) => {
                const value = e.value ?? 1;
                dispatch({
                  type: 'setPageNum',
                  payload: value,
                });
              }}
            />
          </InlineField>

          <InlineField
            label="# results per page"
            tooltip={'The maximum results per page is ' + MAXIMUM_RESULTS_PER_PAGE}
            labelWidth={20}
          >
            <Input
              data-testid={testIds.resultsPerPage}
              value={calculateResultsPerPage(state.resultsPerPage, DEFAULT_RESULTS_PER_PAGE)}
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
};
