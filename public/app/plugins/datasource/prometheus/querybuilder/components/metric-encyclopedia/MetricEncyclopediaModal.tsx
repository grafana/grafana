import { cx } from '@emotion/css';
import debounce from 'debounce-promise';
import { debounce as debounceLodash } from 'lodash';
import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

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
import { regexifyLabelValuesQueryString } from '../../shared/parsingUtils';
import { PromVisualQuery } from '../../types';
import { FeedbackLink } from '.././FeedbackLink';

import { LetterSearch } from './LetterSearch';
import { getMetadata } from './helpers';
import { getStyles } from './styles';
import { PromFilterOption, MetricsData, HaystackDictionary, MetricData } from './types';
import { fuzzySearch } from './uFuzzy';

export const promTypes: PromFilterOption[] = [
  {
    value: 'counter',
    description:
      'A cumulative metric that represents a single monotonically increasing counter whose value can only increase or be reset to zero on restart.',
  },
  {
    value: 'gauge',
    description: 'A metric that represents a single numerical value that can arbitrarily go up and down.',
  },
  {
    value: 'histogram',
    description:
      'A histogram samples observations (usually things like request durations or response sizes) and counts them in configurable buckets.',
  },
  {
    value: 'summary',
    description:
      'A summary samples observations (usually things like request durations and response sizes) and can calculate configurable quantiles over a sliding time window.',
  },
];

export const placeholders = {
  browse: 'Search metrics by name',
  metadataSearchSwitch: 'Search by metadata type and description in addition to name',
  type: 'Select...',
  variables: 'Select...',
  excludeNoMetadata: 'Exclude results with no metadata',
  setUseBackend: 'Use the backend to browse metrics',
};

const DEFAULT_RESULTS_PER_PAGE = 100;
const MAXIMUM_RESULTS_PER_PAGE = 1000;

const debouncedFuzzySearch = debounceLodash(fuzzySearch, 300);

export type MetricEncyclopediaMetadata = {
  isLoading: boolean;
  metrics: MetricsData;
  hasMetadata: boolean;
  metaHaystack: string[];
  nameHaystack: string[];
  metaHaystackDictionary: HaystackDictionary;
  nameHaystackDictionary: HaystackDictionary;
  totalMetricCount: number;
  filteredMetricCount: number | null;
};

// An interface for our actions
type Action =
  | { type: 'setIsLoading'; payload: boolean }
  | {
      type: 'setMetadata';
      payload: MetricEncyclopediaMetadata;
    }
  | {
      type: 'filterMetricsBackend';
      payload: {
        metrics: MetricsData;
        filteredMetricCount: number;
      };
    }
  | { type: 'setFilteredMetricCount'; payload: number }
  | { type: 'setResultsPerPage'; payload: number }
  | { type: 'setPageNum'; payload: number };

// An interface for our state
export interface MetricEncyclopediaState {
  isLoading: boolean;
  metrics: MetricsData;
  hasMetadata: boolean;
  metaHaystack: string[];
  nameHaystack: string[];
  metaHaystackDictionary: HaystackDictionary;
  nameHaystackDictionary: HaystackDictionary;
  totalMetricCount: number;
  filteredMetricCount: number | null;
  resultsPerPage: number;
  pageNum: number;
}

export type MetricEncyclopediaProps = {
  datasource: PrometheusDatasource;
  isOpen: boolean;
  query: PromVisualQuery;
  onClose: () => void;
  onChange: (query: PromVisualQuery) => void;
};

// Our reducer function that uses a switch statement to handle our actions
function MetricEncyclopediaReducer(state: MetricEncyclopediaState, action: Action) {
  const { type, payload } = action;
  switch (type) {
    case 'filterMetricsBackend':
      return {
        ...state,
        ...payload,
      };
    case 'setMetadata':
      return {
        ...state,
        ...payload,
      };
    case 'setIsLoading':
      return {
        ...state,
        isLoading: payload,
      };
    case 'setFilteredMetricCount':
      return {
        ...state,
        filteredMetricCount: payload,
      };
    case 'setResultsPerPage':
      return {
        ...state,
        resultsPerPage: payload,
      };
    case 'setPageNum':
      return {
        ...state,
        pageNum: payload,
      };
    default:
      return state;
  }
}

const initialState = {
  isLoading: true,
  metrics: [],
  hasMetadata: true,
  metaHaystack: [],
  nameHaystack: [],
  metaHaystackDictionary: {},
  nameHaystackDictionary: {},
  totalMetricCount: 0,
  filteredMetricCount: null,
  resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
  pageNum: 1,
};

// next step, access state and update all the things that need to be updated when
// the interactions happen
export const MetricEncyclopediaModal = (props: MetricEncyclopediaProps) => {
  const { datasource, isOpen, onClose, onChange, query } = props;

  const [state, dispatch] = useReducer(MetricEncyclopediaReducer, initialState);

  // filters
  const [fuzzySearchQuery, setFuzzySearchQuery] = useState<string>('');
  const [nameHaystackOrder, setNameHaystackOrder] = useState<string[]>([]);
  const [metaHaystackOrder, setMetaHaystackOrder] = useState<string[]>([]);

  const [fullMetaSearch, setFullMetaSearch] = useState<boolean>(false);
  const [excludeNullMetadata, setExcludeNullMetadata] = useState<boolean>(false);
  const [selectedTypes, setSelectedTypes] = useState<Array<SelectableValue<string>>>([]);
  const [letterSearch, setLetterSearch] = useState<string | null>(null);

  // backend search metric names by text
  const [useBackend, setUseBackend] = useState<boolean>(false);
  const [disableTextWrap, setDisableTextWrap] = useState<boolean>(false);

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
        metaHaystack: data.metaHaystack,
        nameHaystack: data.nameHaystack,
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

  const theme = useTheme2();
  const styles = getStyles(theme, disableTextWrap);

  const typeOptions: SelectableValue[] = promTypes.map((t: PromFilterOption) => {
    return {
      value: t.value,
      label: t.value,
      description: t.description,
    };
  });

  function calculatePageList(metrics: MetricsData, resultsPerPage: number) {
    if (!metrics.length) {
      return [];
    }

    const calcResultsPerPage: number = resultsPerPage === 0 ? 1 : resultsPerPage;

    const pages = Math.floor(filterMetrics(metrics).length / calcResultsPerPage) + 1;

    return [...Array(pages).keys()].map((i) => i + 1);
  }

  function sliceMetrics(metrics: MetricsData, pageNum: number, resultsPerPage: number) {
    const calcResultsPerPage: number = resultsPerPage === 0 ? 1 : resultsPerPage;
    const start: number = pageNum === 1 ? 0 : (pageNum - 1) * calcResultsPerPage;
    const end: number = start + calcResultsPerPage;
    return metrics.slice(start, end);
  }

  /**
   * Filter the metrics with all the options, fuzzy, type, letter
   * @param metrics
   * @param skipLetterSearch used to show the alphabet letters as clickable before filtering out letters (needs to be refactored)
   * @returns
   */
  function filterMetrics(metrics: MetricsData, skipLetterSearch?: boolean): MetricsData {
    let filteredMetrics: MetricsData = metrics;

    if (fuzzySearchQuery && !useBackend) {
      if (fullMetaSearch) {
        filteredMetrics = metaHaystackOrder.map((needle: string) => state.metaHaystackDictionary[needle]);
      } else {
        filteredMetrics = nameHaystackOrder.map((needle: string) => state.nameHaystackDictionary[needle]);
      }
    }

    if (letterSearch && !skipLetterSearch) {
      filteredMetrics = filteredMetrics.filter((m: MetricData, idx) => {
        const letters: string[] = [letterSearch, letterSearch.toLowerCase()];
        return letters.includes(m.value[0]);
      });
    }

    if (selectedTypes.length > 0 && !useBackend) {
      filteredMetrics = filteredMetrics.filter((m: MetricData, idx) => {
        // Matches type
        const matchesSelectedType = selectedTypes.some((t) => t.value === m.type);

        // missing type
        const hasNoType = !m.type;

        return matchesSelectedType || (hasNoType && !excludeNullMetadata);
      });
    }

    if (excludeNullMetadata) {
      filteredMetrics = filteredMetrics.filter((m: MetricData) => {
        return m.type !== undefined && m.description !== undefined;
      });
    }

    return filteredMetrics;
  }

  /**
   * The filtered and paginated metrics displayed in the modal
   * */
  function displayedMetrics(metrics: MetricsData) {
    const filteredSorted: MetricsData = filterMetrics(metrics);

    if (state.filteredMetricCount !== filteredSorted.length && filteredSorted.length !== 0) {
      dispatch({
        type: 'setFilteredMetricCount',
        payload: filteredSorted.length,
      });
    }

    return sliceMetrics(filteredSorted, state.pageNum, state.resultsPerPage);
  }
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
        // setIsLoading(true);
        const queryString = regexifyLabelValuesQueryString(metricText);

        const labelsParams = query.labels.map((label) => {
          return `,${label.label}="${label.value}"`;
        });

        const params = `label_values({__name__=~".*${queryString}"${
          query.labels ? labelsParams.join() : ''
        }},__name__)`;

        const results = datasource.metricFindQuery(params);

        const metrics = await results.then((results) => {
          return results.map((result) => {
            return {
              value: result.text,
            };
          });
        });

        dispatch({
          type: 'filterMetricsBackend',
          payload: {
            metrics: metrics,
            filteredMetricCount: metrics.length,
          },
        });

        dispatch({
          type: 'setIsLoading',
          payload: false,
        });
      }, datasource.getDebounceTimeInMilliseconds()),
    [datasource, query.labels]
  );

  const calculateResultsPerPage = (results: number) => {
    if (results < 1) {
      return 1;
    }

    if (results > MAXIMUM_RESULTS_PER_PAGE) {
      return MAXIMUM_RESULTS_PER_PAGE;
    }

    return results ?? 10;
  };

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
            fuzzySearchQuery: fuzzySearchQuery,
            fullMetaSearch: fullMetaSearch,
            selectedTypes: selectedTypes,
            letterSearch: letterSearch,
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
    if (useBackend && query === '') {
      // get all metrics data if a user erases everything in the input
      updateMetricsMetadata();
    } else if (useBackend) {
      debouncedBackendSearch(query);
    } else {
      // search either the names or all metadata
      // fuzzy search go!

      if (fullMetaSearchVal) {
        debouncedFuzzySearch(state.metaHaystack, query, setMetaHaystackOrder);
      } else {
        debouncedFuzzySearch(state.nameHaystack, query, setNameHaystackOrder);
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
              value={fuzzySearchQuery}
              onInput={(e) => {
                const value = e.currentTarget.value ?? '';
                setFuzzySearchQuery(value);
                setLetterSearch(null);
                fuzzySearchCallback(value, fullMetaSearch);

                dispatch({
                  type: 'setPageNum',
                  payload: 1,
                });
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
              value={selectedTypes}
              disabled={!state.hasMetadata || useBackend}
              placeholder={placeholders.type}
              onChange={(v) => {
                // *** Filter by type
                // *** always include metrics without metadata but label it as unknown type
                // Consider tabs select instead of actual select or multi select
                setSelectedTypes(v);
                dispatch({
                  type: 'setPageNum',
                  payload: 1,
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
                value={fullMetaSearch}
                disabled={useBackend || !state.hasMetadata}
                onChange={() => {
                  const newVal = !fullMetaSearch;
                  setFullMetaSearch(newVal);

                  fuzzySearchCallback(fuzzySearchQuery, newVal);

                  dispatch({
                    type: 'setPageNum',
                    payload: 1,
                  });
                }}
              />
              <p className={styles.selectItemLabel}>{placeholders.metadataSearchSwitch}</p>
            </div>
            <div className={styles.selectItem}>
              <Switch
                data-testid={testIds.setUseBackend}
                value={useBackend}
                onChange={() => {
                  const newVal = !useBackend;
                  setUseBackend(newVal);
                  if (newVal === false) {
                    // rebuild the metrics metadata if we turn off useBackend
                    updateMetricsMetadata();
                  } else {
                    // check if there is text in the browse search and update
                    if (fuzzySearchQuery !== '') {
                      debouncedBackendSearch(fuzzySearchQuery);
                    }
                    // otherwise wait for user typing
                  }
                  dispatch({
                    type: 'setPageNum',
                    payload: 1,
                  });
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
          filteredMetrics={filterMetrics(state.metrics, true)}
          disableTextWrap={disableTextWrap}
          updateLetterSearch={(letter: string) => {
            if (letterSearch === letter) {
              setLetterSearch(null);
            } else {
              setLetterSearch(letter);
            }
            dispatch({
              type: 'setPageNum',
              payload: 1,
            });
          }}
          letterSearch={letterSearch}
        />
        <div className={styles.alphabetRowToggles}>
          <div className={styles.selectItem}>
            <Switch value={disableTextWrap} onChange={() => setDisableTextWrap((p) => !p)} />
            <p className={styles.selectItemLabel}>Disable text wrap</p>
          </div>
          <div className={styles.selectItem}>
            <Switch
              value={excludeNullMetadata}
              disabled={useBackend || !state.hasMetadata}
              onChange={() => {
                setExcludeNullMetadata(!excludeNullMetadata);
                dispatch({
                  type: 'setPageNum',
                  payload: 1,
                });
              }}
            />
            <p className={styles.selectItemLabel}>{placeholders.excludeNoMetadata}</p>
          </div>
        </div>
      </div>

      <div className={styles.results}>{state.metrics && tableResults(displayedMetrics(state.metrics))}</div>

      <div className={styles.pageSettingsWrapper}>
        <div className={styles.pageSettings}>
          <InlineField label="Select page" labelWidth={20} className="query-keyword">
            <Select
              data-testid={testIds.searchPage}
              options={calculatePageList(state.metrics, state.resultsPerPage).map((p) => {
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
              value={calculateResultsPerPage(state.resultsPerPage)}
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
