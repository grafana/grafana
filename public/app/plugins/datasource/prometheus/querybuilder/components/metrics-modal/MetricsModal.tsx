import { css } from '@emotion/css';
import cx from 'classnames';
import debounce from 'debounce-promise';
import React, { FormEvent, useCallback, useEffect, useMemo, useReducer } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, Checkbox, Input, Modal, Switch, useTheme2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../../datasource';
import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector } from '../../../language_utils';
import { promQueryModeller } from '../../PromQueryModeller';
import { PromVisualQuery } from '../../types';

import { AdditionalSettings } from './AdditionalSettings';
import { ExplorerMetricPaginationFooter } from './ExplorerMetricPaginationFooter';
import { FeedbackLink } from './FeedbackLink';
import { LabelFilters } from './LabelFilters';
import { MetricsWrapper } from './MetricsWrapper';
import {
  displayedMetrics,
  formatQueryForExecution,
  getBackendSearchMetrics,
  getLabelNames,
  placeholders,
  promTypes,
  setMetrics,
  tracking,
} from './state/helpers';
import { initialState, MAXIMUM_RESULTS_PER_PAGE, MetricsModalMetadata, stateSlice } from './state/state';
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
  buildLabels,
  filterMetricsBackend,
  setNameHaystack,
  setMetaHaystack,
  setFullMetaSearch,
  setIncludeNullMetadata,
  setUseBackend,
  setDisableTextWrap,
  setFuzzySearchQuery,
  setSelectedTypes,
  showAdditionalSettings,
  setPageNum,
  setResultsPerPage,
  setLabelSearchQuery,
  setLabelValues,
  setSelectedLabelValue,
  clear,
  setQuery,
  setValidatedState,
  toggleUIState,
} = stateSlice.actions;

export const MetricsModal = (props: MetricsModalProps) => {
  const { datasource, isOpen, onClose, onChange: onChangeParent, query } = props;

  const [state, dispatch] = useReducer(stateSlice.reducer, initialState(query));

  const theme = useTheme2();
  const styles = getStyles(theme, state.disableTextWrap);

  const onChange = (query: PromVisualQuery) => {
    dispatch(setQuery({ query }));
  };

  const onRevert = () => {
    dispatch(setQuery({ query: state.initialQuery }));
    onChangeParent(state.initialQuery);
  };

  /**
   * Get label names
   */
  const updateLabels = useCallback(async () => {
    dispatch(setIsLoading(true));
    const data = await getLabelNames(state.query.metric, datasource);
    dispatch(
      buildLabels({
        isLoading: false,
        labelNames: data,
      })
    );
  }, [state.query.metric, datasource]);

  const formatQueryForExecution = () => {
    const expr = promQueryModeller.renderLabels(
      state.query.labels?.map((label) => {
        // Any non regex operator
        if (label.op === '=' || label.op === '!=' || label.op === '<' || label.op === '>') {
          return {
            ...label,
            value: escapeLabelValueInExactSelector(label.value),
          };
        }

        // Regex operators
        return {
          ...label,
          // value: escapeLabelValueInRegexSelector(label.value),
          value: label.value
            .split('|')
            .map((v) => escapeLabelValueInRegexSelector(v))
            .join('|'),
        };
      })
    );

    return { expr: expr, metric: state.query.metric, query: state.query.metric + expr };
  };

  const fetchMetrics = useCallback(
    async (metricText: string) => {
      console.log('metricText', metricText);
      console.log('state.query.labels', state.query.labels);
      const metrics = await getBackendSearchMetrics(metricText, state.query.labels, datasource);
      console.log('metrics', metrics);
      dispatch(
        filterMetricsBackend({
          metrics: metrics,
          filteredMetricCount: metrics.length,
          isLoading: false,
          metricsStale: false,
        })
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datasource, state.query.labels, state.query.metric]
  );

  /**
   * The backend debounced search
   */
  const debouncedBackendSearch = useMemo(
    () =>
      debounce(async (metricText: string) => {
        dispatch(setIsLoading(true));

        await fetchMetrics(metricText);
      }, datasource.getDebounceTimeInMilliseconds()),
    [datasource, fetchMetrics]
  );

  function fuzzyNameDispatch(haystackData: string[][]) {
    dispatch(setNameHaystack(haystackData));
  }

  function fuzzyMetaDispatch(haystackData: string[][]) {
    dispatch(setMetaHaystack(haystackData));
  }

  async function getLabelValues(labelName: string): Promise<string[]> {
    const expr = promQueryModeller.renderLabels(state.query.labels);
    console.log('current expr', state.query.metric);
    console.log('pending expr', expr);
    console.log('state.query.metric + expr', state.query.metric + expr);
    // No expression needed for label values, as that would filter any values that aren't already selected, and the logic for multiple selected values is boolean OR
    return datasource.languageProvider.fetchSeriesValuesWithMatch(labelName, state.query.metric);
  }

  function metricsSearchCallback(query: string, fullMetaSearchVal: boolean) {
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

  const validateQuery = async () => {
    // this.setState({ validationStatus: `Validating selector ${selector}`, error: '' });

    datasource.languageProvider
      .fetchSeriesValuesWithMatch('__name__', queryString)
      .then((result) => {
        dispatch(
          setValidatedState({
            isValid: true,
            validMetrics: Object.keys(result).length,
          })
        );
      })
      .catch((err) => {
        console.warn('failed to validate query', err);
        setValidatedState({
          isValid: false,
          validMetrics: undefined,
        });

        // let the panel show error?
        throw err;
      });
  };

  /**
   * "Submits" the query by syncing the local query with the parent query, this will trigger the onChange actions in Grafana and run the query
   */
  const submitQuery = () => {
    // Overwrite existing query with local
    onChangeParent({
      ...query,
      ...state.query,
    });

    // Close the modal
    onClose();
  };

  /**
   * sets a label value as selected
   * @param labelName
   * @param labelValue
   * @param selected
   */
  const setLabelValueSelected = async (labelName: string, labelValue: string, selected: boolean) => {
    dispatch(
      setSelectedLabelValue({
        labelName: labelName,
        labelValue: labelValue,
        checked: selected,
      })
    );
  };

  /**
   * Get the label values for a single label name
   * @param labelName
   */
  const fetchValuesForLabelName = async (labelName: string) => {
    dispatch(setIsLoading(true));
    getLabelValues(labelName).then((values) => {
      dispatch(
        setLabelValues({
          isLoading: false,
          labelName: labelName,
          labelValues: values,
          clearStale: true,
        })
      );
    });
  };

  const onChangePageNum = (e: FormEvent<HTMLInputElement>) => {
    // cast as number
    const value = +e.currentTarget.value;

    if (isNaN(value) || value >= MAXIMUM_RESULTS_PER_PAGE) {
      return;
    }

    dispatch(setResultsPerPage(value));
  };

  const onNavigate = (val: number) => {
    const page = val ?? 1;
    dispatch(setPageNum(page));
  };

  // Gets the raw query string we'll send to the API
  const { expr, query: queryString } = formatQueryForExecution();

  /**
   * loads metrics and metadata on opening modal and switching off useBackend
   */
  const updateMetricsMetadata = useCallback(async () => {
    // *** Loading Gif
    dispatch(setIsLoading(true));

    const data: MetricsModalMetadata = await setMetrics(
      datasource,
      state.lastBackendResultMetrics.map((metric) => metric.value)
    );

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
  }, [datasource, state.lastBackendResultMetrics]);

  /**
   * For all of the stale labels, fetch their values from the datasource in sequence
   * @todo, parallel might be faster, but would folks ddos their prometheus instance?
   */
  async function fetchLabelsInSequence() {
    for (let i = 0; i < state.staleLabelValues.length; i++) {
      await fetchValuesForLabelName(state.staleLabelValues[i]);
    }
  }

  /**
   * @todo WIP toggles the state between labels/metrics
   */
  const toggleMetricsLabels = () => {
    dispatch(toggleUIState());
  };

  const typeOptions: SelectableValue[] = promTypes.map((t: PromFilterOption) => {
    return {
      value: t.value,
      label: t.value,
      description: t.description,
    };
  });

  /**
   * Metrics are stale
   */
  useEffect(() => {
    if (state.metricsStale) {
      fetchMetrics(state.fuzzySearchQuery);
    }

    // We explicitly DO NOT want to run this whenever the fuzzy search query changes, only when the metrics are marked stale by the reducer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.metricsStale]);

  /**
   * Label names are stale
   */
  useEffect(() => {
    if (state.labelNamesStale) {
      const { metric } = formatQueryForExecution();

      dispatch(setIsLoading(true));
      // No need for the labels expression, we just want to query the potential label names for the selected metric
      getLabelNames(metric, datasource).then((data) => {
        dispatch(
          buildLabels({
            isLoading: false,
            labelNames: data,
          })
        );
      });
    }
    // We explicitly DO NOT want to run this whenever the fuzzy search query changes, only when the metrics are marked stale by the reducer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.labelNamesStale]);

  /**
   * Label values are stale
   */
  useEffect(() => {
    if (state.staleLabelValues.length > 0) {
      fetchLabelsInSequence();
    }
    // We explicitly DO NOT want to run this whenever the fuzzy search query changes, only when the metrics are marked stale by the reducer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.staleLabelValues]);

  useEffect(() => {
    updateMetricsMetadata();
  }, [updateMetricsMetadata]);

  useEffect(() => {
    updateLabels();
  }, [updateLabels]);

  useEffect(() => {
    updateMetricsMetadata();
  }, [updateMetricsMetadata]);

  /* Settings switches */
  const additionalSettings = (
    <AdditionalSettings
      state={state}
      onChangeFullMetaSearch={() => {
        const newVal = !state.fullMetaSearch;
        dispatch(setFullMetaSearch(newVal));
        onChange({ ...state.query, fullMetaSearch: newVal });
        metricsSearchCallback(state.fuzzySearchQuery, newVal);
      }}
      onChangeIncludeNullMetadata={() => {
        dispatch(setIncludeNullMetadata(!state.includeNullMetadata));
        onChange({ ...state.query, includeNullMetadata: !state.includeNullMetadata });
      }}
      onChangeDisableTextWrap={() => {
        dispatch(setDisableTextWrap());
        onChange({ ...state.query, disableTextWrap: !state.disableTextWrap });
        tracking('grafana_prom_metric_encycopedia_disable_text_wrap_interaction', state, '');
      }}
      onChangeUseBackend={() => {
        const newVal = !state.useBackend;
        dispatch(setUseBackend(newVal));
        onChange({ ...state.query, useBackend: newVal });
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

  console.log('state', state);

  return (
    <Modal
      data-testid={testIds.metricModal}
      isOpen={isOpen}
      title="Metrics explorer"
      onDismiss={() => {
        onRevert();
        onClose();
      }}
      aria-label="Browse metrics"
      className={styles.modal}
    >
      <FeedbackLink feedbackUrl="https://forms.gle/DEMAJHoAMpe3e54CA" />

      <div className={styles.uiStateToggle}>
        <Switch label={'browse by metrics'} checked={state.UIState === 'metrics'} onChange={toggleMetricsLabels} />
      </div>
      <div className={cx(styles.wrapper, state.UIState === 'labels' ? styles.wrapperLabels : styles.wrapperMetrics)}>
        {state.UIState === 'labels' && (
          <div className={styles.modalLabelsWrapper}>
            <div className={styles.labelsSearchWrapper}>
              <div className={cx(styles.labelInputItem)}>
                <Input
                  autoFocus={true}
                  data-testid={testIds.searchLabels}
                  placeholder={placeholders.labelSearch}
                  value={state.labelSearchQuery}
                  onInput={(e) => {
                    const value = e.currentTarget.value ?? '';
                    dispatch(setLabelSearchQuery(value));
                  }}
                />
              </div>
            </div>

            <div className={styles.labelsWrapper}>
              <div className={styles.labelsTitle}>Label name</div>
              <LabelFilters
                query={query}
                state={state}
                fetchValuesForLabelName={fetchValuesForLabelName}
                setLabelValueSelected={setLabelValueSelected}
              />
            </div>
          </div>
        )}

        {/* METRICS */}
        <div className={styles.modalMetricsWrapper}>
          <MetricsWrapper
            state={state}
            searchCallback={metricsSearchCallback}
            options={typeOptions}
            content={additionalSettings}
            query={state.query} /* @todo fix the hack */
            onChange={onChange}
            onClose={onClose}
            onFuzzySearchQuery={(e) => {
              const value = e.currentTarget.value ?? '';
              dispatch(setFuzzySearchQuery(value));
              metricsSearchCallback(value, state.fullMetaSearch);
            }}
            onSetSelectedTypes={(v) => dispatch(setSelectedTypes(v))}
            onShowAdditionalSettings={() => dispatch(showAdditionalSettings())}
            displayedMetrics={displayedMetrics(state, dispatch)}
            onNavigate={onNavigate}
            onChangePageNumber={onChangePageNum}
            clearQuery={() => dispatch(clear())}
            fetchValuesForLabelName={fetchValuesForLabelName}
            setLabelValueSelected={setLabelValueSelected}
          />
          {/* We want this to be sticky to the metrics section, not the entire mobile, so we have a slightly different DOM structure to accomodate a better mobile UX */}
          <div className={cx(styles.mobileOnly, styles.stickyMobileFooter)}>
            <ExplorerMetricPaginationFooter state={state} onNavigate={onNavigate} onInput={onChangePageNum} />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className={styles.footer}>
        <div className={styles.tabletPlus}>
          <ExplorerMetricPaginationFooter state={state} onNavigate={onNavigate} onInput={onChangePageNum} />
        </div>

        <div className={styles.exprPreviewWrap}>
          <span className={styles.exprPreview}>
            <div className={styles.exprPreviewTextWrap}>
              <span className={styles.exprPreviewTitle}>RESULT</span>
              <span className={styles.exprPreviewText}>{queryString}</span>
            </div>
          </span>
          <span className={styles.exprButtons}>
            <Button onClick={() => dispatch(clear())} type={'button'} variant={'destructive'}>
              Clear
            </Button>
            <Button onClick={() => validateQuery()} type={'button'} variant={'secondary'}>
              Validate
            </Button>
          </span>
        </div>

        <div className={styles.selectorValidMessage}>
          {state.numberOfSeriesForQuery !== undefined
            ? `Selector is valid (${state.numberOfSeriesForQuery} series found)`
            : ''}
        </div>

        <div className={styles.submitQueryButton}>
          <Button onClick={submitQuery}>Use query</Button>
        </div>
      </div>
    </Modal>
  );
};

export const LabelNameLabel = (props: { labelName: string }) => {
  const { labelName } = props;
  const theme = useTheme2();
  const styles = getLabelNameLabelStyles(theme);
  return <div className={styles.labelName}>{labelName}</div>;
};

export const getLabelNameLabelStyles = (theme: GrafanaTheme2) => {
  return {
    labelName: css`
      font-size: ${theme.typography.fontSize}px;
      padding: 5px 8px 5px 16px;
    `,
  };
};

export const LabelNameValue = (props: {
  labelName: string;
  labelValue: string;
  onChange: React.FormEventHandler<HTMLInputElement>;
  checked: boolean;
}) => {
  const { labelValue, onChange, checked } = props;
  const theme = useTheme2();
  const styles = getLabelValueLabelStyles(theme);
  return (
    <div className={styles.labelName}>
      <Checkbox onChange={onChange} label={labelValue} checked={checked} />
    </div>
  );
};

export const getLabelValueLabelStyles = (theme: GrafanaTheme2) => {
  return {
    labelName: css`
      padding: 5px 8px 5px 32px;
    `,
  };
};

export const testIds = {
  searchLabels: 'search-labels',
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
