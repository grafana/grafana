import { css } from '@emotion/css';
import cx from 'classnames';
import debounce from 'debounce-promise';
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Checkbox, CollapsableSection, Input, Modal, useTheme2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../../datasource';
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

  /**
   * Get label names
   */
  const updateLabels = useCallback(async () => {
    dispatch(setIsLoading(true));
    const data = await getLabelNames(query.metric, datasource);
    dispatch(
      buildLabels({
        isLoading: false,
        labelNames: data,
      })
    );
  }, [query.metric, datasource]);

  useEffect(() => {
    updateMetricsMetadata();
  }, [updateMetricsMetadata]);

  useEffect(() => {
    updateLabels();
  }, [updateLabels]);

  useEffect(() => {
    if (state.metricsStale === true) {
      updateMetricsMetadata();
    }
  }, [state.metricsStale, updateMetricsMetadata]);

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

  async function getLabelValues(labelName: string): Promise<string[]> {
    return datasource.languageProvider.fetchSeriesValuesWithMatch(labelName, query.metric);
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

  console.log('state.selectedLabelValues', state.selectedLabelValues);
  console.log('state.labelValues', state.labelValues);

  return (
    <Modal
      data-testid={testIds.metricModal}
      isOpen={isOpen}
      title="Metrics explorer"
      onDismiss={onClose}
      aria-label="Browse metrics"
      className={styles.modal}
    >
      <FeedbackLink feedbackUrl="https://forms.gle/DEMAJHoAMpe3e54CA" />
      <div className={styles.wrapper}>
        <div className={styles.modalMetricsWrapper}>
          <MetricsWrapper
            state={state}
            searchCallback={searchCallback}
            options={typeOptions}
            content={additionalSettings}
            query={query}
            onChange={onChange}
            onClose={onClose}
            onFuzzySearchQuery={(e) => {
              const value = e.currentTarget.value ?? '';
              dispatch(setFuzzySearchQuery(value));
              searchCallback(value, state.fullMetaSearch);
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
                  searchCallback(value, state.fullMetaSearch);
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
                      state.selectedLabelValues.some(
                        (label) =>
                          label.label === labelName && (label.value.includes(labelValue) || label.value === labelValue)
                      ) ?? false
                    }
                  />
                ))}
              </CollapsableSection>
            ))}
          </div>
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
