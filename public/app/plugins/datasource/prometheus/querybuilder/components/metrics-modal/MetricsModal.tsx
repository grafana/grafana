import { css } from '@emotion/css';
import cx from 'classnames';
import debounce from 'debounce-promise';
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, Checkbox, CollapsableSection, Input, Modal, useTheme2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../../datasource';
import { QueryBuilderLabelFilter } from '../../shared/types';
import { PromVisualQuery } from '../../types';

import { AdditionalSettings } from './AdditionalSettings';
import { FeedbackLink } from './FeedbackLink';
import { MetricsWrapper } from './MetricsWrapper';
import {
  displayedMetrics,
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
   * loads metrics and metadata on opening modal and switching off useBackend
   */
  const updateMetricsMetadata = useCallback(async () => {
    // *** Loading Gif
    dispatch(setIsLoading(true));
    // console.log('query', state.query)
    console.log('initialMetrics', state.initialMetrics);
    const data: MetricsModalMetadata = await setMetrics(
      datasource,
      state.initialMetrics.map((metric) => metric.value)
    );
    console.log('MetricsModalMetadata', data);
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
  }, [datasource, state.initialMetrics]);

  useEffect(() => {
    if (state.metricsStale) {
      fetchMetrics(state.fuzzySearchQuery);
    }

    // We explicitly DO NOT want to run this whenever the fuzzy search query changes, only when the metrics are marked stale by the reducer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.metricsStale]);

  useEffect(() => {
    if (state.labelNamesStale) {
      getLabelNames(state.query.metric, datasource);
    }

    // We explicitly DO NOT want to run this whenever the fuzzy search query changes, only when the metrics are marked stale by the reducer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.labelNamesStale]);

  useEffect(() => {
    if (state.staleLabelValues.length) {
    }
    // We explicitly DO NOT want to run this whenever the fuzzy search query changes, only when the metrics are marked stale by the reducer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.staleLabelValues]);

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

  useEffect(() => {
    updateMetricsMetadata();
  }, [updateMetricsMetadata]);

  useEffect(() => {
    updateLabels();
  }, [updateLabels]);

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

  const fetchMetrics = useCallback(
    async (metricText: string) => {
      console.log('metricText', metricText);
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
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

  const submitQuery = () => {
    onChangeParent({
      ...query,
      ...state.query,
    });
    onClose();
  };

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
      <div className={styles.wrapper}>
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
            onNavigate={(val: number) => {
              const page = val ?? 1;
              dispatch(setPageNum(page));
            }}
            onChangePageNumber={(e) => {
              const value = +e.currentTarget.value;

              if (isNaN(value) || value >= MAXIMUM_RESULTS_PER_PAGE) {
                return;
              }

              dispatch(setResultsPerPage(value));
            }}
            clearQuery={() => dispatch(clear())}
          />
        </div>
        <div className={styles.modalLabelsWrapper}>
          <div className={styles.inputWrapper}>
            <div className={cx(styles.inputItem, styles.inputItemFirst)}>
              <Input
                autoFocus={true}
                data-testid={testIds.searchMetric}
                placeholder={placeholders.browse}
                value={state.labelSearchQuery}
                onInput={(e) => {
                  const value = e.currentTarget.value ?? '';
                  dispatch(setLabelSearchQuery(value));
                  metricsSearchCallback(value, state.fullMetaSearch);
                }}
              />
            </div>
          </div>
          <div className={styles.labelsWrapper}>
            <div className={styles.labelsTitle}>Label name</div>
            {state.labelNames.map((labelName, index) => (
              <CollapsableSection
                key={'label_names_' + labelName}
                label={<LabelNameLabel labelName={labelName} />}
                onToggle={(isOpen: boolean) => {
                  if (isOpen) {
                    dispatch(setIsLoading(true));
                    getLabelValues(labelName).then((values) => {
                      dispatch(
                        setLabelValues({
                          isLoading: false,
                          labelName: labelName,
                          labelValues: values,
                        })
                      );
                    });
                  }
                }}
                isOpen={false}
              >
                {state.labelValues[labelName]?.map((labelValue) => (
                  <LabelNameValue
                    key={'label_values_' + labelValue}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      dispatch(
                        setSelectedLabelValue({
                          labelName: labelName,
                          labelValue: labelValue,
                          checked: checked,
                        })
                      );
                    }}
                    labelName={labelName}
                    labelValue={labelValue}
                    checked={
                      state.query.labels.some(
                        (label: QueryBuilderLabelFilter) =>
                          label.label === labelName && (label.value.includes(labelValue) || label.value === labelValue)
                      ) ?? false
                    }
                  />
                ))}
              </CollapsableSection>
            ))}
          </div>
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
    labelName: css``,
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
    labelName: css``,
  };
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
