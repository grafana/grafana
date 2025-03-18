// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/MetricSelect.tsx
import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import { RefCallback, useCallback, useState } from 'react';
import * as React from 'react';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2, SelectableValue, toOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import {
  AsyncSelect,
  Button,
  FormatOptionLabelMeta,
  getSelectStyles,
  Icon,
  InlineField,
  InlineFieldRow,
  ScrollContainer,
  SelectMenuOptions,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { truncateResult } from '../../language_utils';
import { regexifyLabelValuesQueryString } from '../parsingUtils';
import { QueryBuilderLabelFilter } from '../shared/types';
import { PromVisualQuery } from '../types';

import { MetricsModal } from './metrics-modal/MetricsModal';
import { tracking } from './metrics-modal/state/helpers';

// We are matching words split with space
const splitSeparator = ' ';

export interface MetricSelectProps {
  metricLookupDisabled: boolean;
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  onGetMetrics: () => Promise<SelectableValue[]>;
  datasource: PrometheusDatasource;
  labelsFilters: QueryBuilderLabelFilter[];
  onBlur?: () => void;
  variableEditor?: boolean;
}

export const PROMETHEUS_QUERY_BUILDER_MAX_RESULTS = 1000;

export function MetricSelect({
  datasource,
  query,
  onChange,
  onGetMetrics,
  labelsFilters,
  metricLookupDisabled,
  onBlur,
  variableEditor,
}: Readonly<MetricSelectProps>) {
  const styles = useStyles2(getStyles);
  const [state, setState] = useState<{
    metrics?: SelectableValue[];
    isLoading?: boolean;
    metricsModalOpen?: boolean;
    initialMetrics?: string[];
    resultsTruncated?: boolean;
  }>({});

  const metricsModalOption: SelectableValue[] = [
    {
      value: 'BrowseMetrics',
      label: 'Metrics explorer',
      description: 'Browse and filter all metrics and metadata with a fuzzy search',
    },
  ];

  const customFilterOption = useCallback((option: SelectableValue, searchQuery: string) => {
    const label = option.label ?? option.value;
    if (!label) {
      return false;
    }

    // custom value is not a string label but a react node
    if (!label.toLowerCase) {
      return true;
    }

    const searchWords = searchQuery.split(splitSeparator);

    return searchWords.reduce((acc, cur) => {
      const matcheSearch = label.toLowerCase().includes(cur.toLowerCase());
      const browseOption = label === 'Metrics explorer';
      return acc && (matcheSearch || browseOption);
    }, true);
  }, []);

  const formatOptionLabel = useCallback(
    (option: SelectableValue, meta: FormatOptionLabelMeta<any>) => {
      // For newly created custom value we don't want to add highlight
      if (option['__isNew__']) {
        return option.label;
      }
      // only matches on input, does not match on regex
      // look into matching for regex input
      return (
        <Highlighter
          searchWords={meta.inputValue.split(splitSeparator)}
          textToHighlight={option.label ?? ''}
          highlightClassName={styles.highlight}
        />
      );
    },
    [styles.highlight]
  );

  /**
   * Reformat the query string and label filters to return all valid results for current query editor state
   */
  const formatKeyValueStringsForLabelValuesQuery = (
    query: string,
    labelsFilters?: QueryBuilderLabelFilter[]
  ): string => {
    const queryString = regexifyLabelValuesQueryString(query);

    return formatPrometheusLabelFiltersToString(queryString, labelsFilters);
  };

  /**
   * Gets label_values response from prometheus API for current autocomplete query string and any existing labels filters
   */
  const getMetricLabels = (query: string) => {
    // Since some customers can have millions of metrics, whenever the user changes the autocomplete text we want to call the backend and request all metrics that match the current query string
    const results = datasource.metricFindQuery(formatKeyValueStringsForLabelValuesQuery(query, labelsFilters));
    return results.then((results) => {
      const resultsLength = results.length;
      truncateResult(results);

      if (resultsLength > results.length) {
        setState({ ...state, resultsTruncated: true });
      } else {
        setState({ ...state, resultsTruncated: false });
      }

      const resultsOptions = results.map((result) => {
        return {
          label: result.text,
          value: result.text,
        };
      });

      return [...metricsModalOption, ...resultsOptions];
    });
  };

  // When metric and label lookup is disabled we won't request labels
  const metricLookupDisabledSearch = () => Promise.resolve([]);

  const debouncedSearch = debounce(
    (query: string) => getMetricLabels(query),
    datasource.getDebounceTimeInMilliseconds()
  );

  // No type found for the common select props so typing as any
  // https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/Select/SelectBase.tsx/#L212-L263
  // eslint-disable-next-line
  const CustomOption = (props: any) => {
    const option = props.data;

    if (option.value === 'BrowseMetrics') {
      const isFocused = props.isFocused ? styles.focus : '';

      return (
        // TODO: fix keyboard a11y
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          {...props.innerProps}
          ref={props.innerRef}
          className={`${styles.customOptionWidth} metric-encyclopedia-open`}
          data-testid={selectors.components.Select.option}
          onKeyDown={(e) => {
            // if there is no metric and the m.e. is enabled, open the modal
            if (e.code === 'Enter') {
              setState({ ...state, metricsModalOpen: true });
            }
          }}
        >
          {
            <div className={`${styles.customOption} ${isFocused} metric-encyclopedia-open`}>
              <div>
                <div className="metric-encyclopedia-open">{option.label}</div>
                <div className={`${styles.customOptionDesc} metric-encyclopedia-open`}>{option.description}</div>
              </div>
              <Button
                fill="text"
                size="sm"
                variant="secondary"
                onClick={() => setState({ ...state, metricsModalOpen: true })}
                className="metric-encyclopedia-open"
              >
                Open
                <Icon name="arrow-right" />
              </Button>
            </div>
          }
        </div>
      );
    }

    return SelectMenuOptions(props);
  };

  interface SelectMenuProps {
    maxHeight: number;
    innerRef: RefCallback<HTMLDivElement>;
    innerProps: {};
  }

  const CustomMenu = ({ children, maxHeight, innerRef, innerProps }: React.PropsWithChildren<SelectMenuProps>) => {
    const theme = useTheme2();
    const stylesMenu = getSelectStyles(theme);

    // Show the results trucated warning only if the options are loaded and the results are truncated
    // The children are a react node(options loading node) or an array(not a valid element)
    const optionsLoaded = !React.isValidElement(children) && state.resultsTruncated;

    return (
      <div
        {...innerProps}
        className={`${stylesMenu.menu} ${styles.customMenuContainer}`}
        style={{ maxHeight: Math.round(maxHeight * 0.9) }}
        aria-label="Select options menu"
      >
        <ScrollContainer ref={innerRef} showScrollIndicators>
          {children}
        </ScrollContainer>
        {optionsLoaded && (
          <div className={styles.customMenuFooter}>
            <div>
              Only the top 1000 metrics are displayed in the metric select. Use the metrics explorer to view all
              metrics.
            </div>
          </div>
        )}
      </div>
    );
  };

  const asyncSelect = () => {
    return (
      <AsyncSelect
        data-testid={selectors.components.DataSource.Prometheus.queryEditor.builder.metricSelect}
        isClearable={Boolean(variableEditor)}
        inputId="prometheus-metric-select"
        className={styles.select}
        value={query.metric ? toOption(query.metric) : undefined}
        placeholder={'Select metric'}
        allowCustomValue
        formatOptionLabel={formatOptionLabel}
        filterOption={customFilterOption}
        minMenuHeight={250}
        onOpenMenu={async () => {
          if (metricLookupDisabled) {
            return;
          }
          setState({ isLoading: true });
          const metrics = await onGetMetrics();
          const initialMetrics: string[] = metrics.map((m) => m.value);
          const resultsLength = metrics.length;

          if (metrics.length > PROMETHEUS_QUERY_BUILDER_MAX_RESULTS) {
            truncateResult(metrics);
          }

          setState({
            // add the modal button option to the options
            metrics: [...metricsModalOption, ...metrics],
            isLoading: undefined,
            // pass the initial metrics into the metrics explorer
            initialMetrics: initialMetrics,
            resultsTruncated: resultsLength > metrics.length,
          });
        }}
        loadOptions={metricLookupDisabled ? metricLookupDisabledSearch : debouncedSearch}
        isLoading={state.isLoading}
        defaultOptions={state.metrics ?? Array.from(new Array(25), () => ({ value: '' }))} // We need empty values when `state.metrics` is falsy in order for the select to correctly determine top/bottom placement
        onChange={(input) => {
          const value = input?.value;
          if (value) {
            // if there is no metric and the value is the custom m.e. option, open the modal
            if (value === 'BrowseMetrics') {
              tracking('grafana_prometheus_metric_encyclopedia_open', null, '', query);
              setState({ ...state, metricsModalOpen: true });
            } else {
              onChange({ ...query, metric: value });
            }
          } else {
            onChange({ ...query, metric: '' });
          }
        }}
        components={{ Option: CustomOption, MenuList: CustomMenu }}
        onBlur={onBlur}
      />
    );
  };

  return (
    <>
      {!datasource.lookupsDisabled && state.metricsModalOpen && (
        <MetricsModal
          datasource={datasource}
          isOpen={state.metricsModalOpen}
          onClose={() => setState({ ...state, metricsModalOpen: false })}
          query={query}
          onChange={onChange}
          initialMetrics={state.initialMetrics ?? []}
        />
      )}
      {/* format the ui for either the query editor or the variable editor */}
      {variableEditor ? (
        <InlineFieldRow>
          <InlineField
            label="Metric"
            labelWidth={20}
            tooltip={<div>Optional: returns a list of label values for the label name in the specified metric.</div>}
          >
            {asyncSelect()}
          </InlineField>
        </InlineFieldRow>
      ) : (
        <EditorFieldGroup>
          <EditorField label="Metric">{asyncSelect()}</EditorField>
        </EditorFieldGroup>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  select: css({
    minWidth: '125px',
  }),
  highlight: css({
    label: 'select__match-highlight',
    background: 'inherit',
    padding: 'inherit',
    color: theme.colors.warning.contrastText,
    backgroundColor: theme.colors.warning.main,
  }),
  customOption: css({
    padding: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.1),
    },
  }),
  customOptionlabel: css({
    color: theme.colors.text.primary,
  }),
  customOptionDesc: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.xs,
    opacity: '50%',
  }),
  focus: css({
    backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.1),
  }),
  customOptionWidth: css({
    minWidth: '400px',
  }),
  customMenuFooter: css({
    flex: 0,
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.text.secondary,
  }),
  customMenuContainer: css({
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.primary,
    boxShadow: theme.shadows.z3,
  }),
});

export const formatPrometheusLabelFiltersToString = (
  queryString: string,
  labelsFilters: QueryBuilderLabelFilter[] | undefined
): string => {
  const filterArray = labelsFilters ? formatPrometheusLabelFilters(labelsFilters) : [];

  return `label_values({__name__=~".*${queryString}"${filterArray ? filterArray.join('') : ''}},__name__)`;
};

export const formatPrometheusLabelFilters = (labelsFilters: QueryBuilderLabelFilter[]): string[] => {
  return labelsFilters.map((label) => {
    return `,${label.label}="${label.value}"`;
  });
};
