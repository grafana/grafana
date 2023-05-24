import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { RefCallback, useCallback, useState } from 'react';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2, SelectableValue, toOption } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import {
  AsyncSelect,
  Button,
  CustomScrollbar,
  FormatOptionLabelMeta,
  getSelectStyles,
  Icon,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { regexifyLabelValuesQueryString } from '../shared/parsingUtils';
import { QueryBuilderLabelFilter } from '../shared/types';
import { PromVisualQuery } from '../types';

import { MetricsModal } from './metrics-modal/MetricsModal';

// We are matching words split with space
const splitSeparator = ' ';

export interface Props {
  metricLookupDisabled: boolean;
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  onGetMetrics: () => Promise<SelectableValue[]>;
  datasource: PrometheusDatasource;
  labelsFilters: QueryBuilderLabelFilter[];
}

export const PROMETHEUS_QUERY_BUILDER_MAX_RESULTS = 1000;

const prometheusMetricEncyclopedia = config.featureToggles.prometheusMetricEncyclopedia;

export function MetricSelect({
  datasource,
  query,
  onChange,
  onGetMetrics,
  labelsFilters,
  metricLookupDisabled,
}: Props) {
  const styles = useStyles2(getStyles);
  const [state, setState] = useState<{
    metrics?: Array<SelectableValue<any>>;
    isLoading?: boolean;
    metricsModalOpen?: boolean;
    initialMetrics?: string[];
  }>({});

  const customFilterOption = useCallback((option: SelectableValue<any>, searchQuery: string) => {
    const label = option.label ?? option.value;
    if (!label) {
      return false;
    }

    // custom value is not a string label but a react node
    if (!label.toLowerCase) {
      return true;
    }

    const searchWords = searchQuery.split(splitSeparator);
    return searchWords.reduce((acc, cur) => acc && label.toLowerCase().includes(cur.toLowerCase()), true);
  }, []);

  const formatOptionLabel = useCallback(
    (option: SelectableValue<any>, meta: FormatOptionLabelMeta<any>) => {
      // For newly created custom value we don't want to add highlight
      if (option['__isNew__']) {
        return option.label;
      }

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
      if (results.length > PROMETHEUS_QUERY_BUILDER_MAX_RESULTS) {
        results.splice(0, results.length - PROMETHEUS_QUERY_BUILDER_MAX_RESULTS);
      }
      return results.map((result) => {
        return {
          label: result.text,
          value: result.text,
        };
      });
    });
  };

  // When metric and label lookup is disabled we won't request labels
  const metricLookupDisabledSearch = () => Promise.resolve([]);

  const debouncedSearch = debounce(
    (query: string) => getMetricLabels(query),
    datasource.getDebounceTimeInMilliseconds()
  );

  interface SelectMenuProps {
    maxHeight: number;
    innerRef: RefCallback<HTMLDivElement>;
    innerProps: {};
  }

  const CustomMenu = ({ children, maxHeight, innerRef, innerProps }: React.PropsWithChildren<SelectMenuProps>) => {
    const theme = useTheme2();
    const stylesMenu = getSelectStyles(theme);

    return (
      <div
        {...innerProps}
        className={`${stylesMenu.menu} ${styles.container}`}
        style={{ maxHeight }}
        aria-label="Select options menu"
      >
        <CustomScrollbar scrollRefCallback={innerRef} autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
          {children}
        </CustomScrollbar>
        <div className={styles.footer}>
          <div>
            Browse metrics
            <div className={`${styles.description} metric-encyclopedia-open`}>
              Browse and filter metrics and metadata with a fuzzy search
            </div>
          </div>

          <Button
            size="sm"
            variant="secondary"
            fill="text"
            className="metric-encyclopedia-open"
            onClick={() => {
              setState({ ...state, metricsModalOpen: true });
            }}
          >
            Open
            <Icon name="arrow-right" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      {prometheusMetricEncyclopedia && !datasource.lookupsDisabled && state.metricsModalOpen && (
        <MetricsModal
          datasource={datasource}
          isOpen={state.metricsModalOpen}
          onClose={() => setState({ ...state, metricsModalOpen: false })}
          query={query}
          onChange={onChange}
          initialMetrics={state.initialMetrics ?? []}
        />
      )}
      <EditorFieldGroup>
        <EditorField label="Metric">
          <AsyncSelect
            inputId="prometheus-metric-select"
            className={styles.select}
            value={query.metric ? toOption(query.metric) : undefined}
            placeholder={'Select metric'}
            allowCustomValue
            formatOptionLabel={formatOptionLabel}
            filterOption={customFilterOption}
            onOpenMenu={async () => {
              if (metricLookupDisabled) {
                return;
              }
              setState({ isLoading: true });
              const metrics = await onGetMetrics();
              const initialMetrics: string[] = metrics.map((m) => m.value);
              if (metrics.length > PROMETHEUS_QUERY_BUILDER_MAX_RESULTS) {
                metrics.splice(0, metrics.length - PROMETHEUS_QUERY_BUILDER_MAX_RESULTS);
              }

              if (prometheusMetricEncyclopedia) {
                // pass the initial metrics into the Metrics Modal
                setState({
                  metrics: metrics,
                  isLoading: undefined,
                  initialMetrics: initialMetrics,
                });
              } else {
                setState({ metrics, isLoading: undefined });
              }
            }}
            loadOptions={metricLookupDisabled ? metricLookupDisabledSearch : debouncedSearch}
            isLoading={state.isLoading}
            defaultOptions={state.metrics}
            onChange={({ value }) => {
              if (value) {
                onChange({ ...query, metric: value });
              }
            }}
            components={prometheusMetricEncyclopedia ? { MenuList: CustomMenu } : {}}
          />
        </EditorField>
      </EditorFieldGroup>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  select: css`
    min-width: 125px;
  `,
  highlight: css`
    label: select__match-highlight;
    background: inherit;
    padding: inherit;
    color: ${theme.colors.warning.contrastText};
    background-color: ${theme.colors.warning.main};
  `,
  footer: css`
    flex: 0;
    display: flex;
    justify-content: space-between;
    padding: ${theme.spacing(1.5)};
    border-top: 1px solid ${theme.colors.border.weak};
    background-color: ${theme.colors.background.secondary};
  `,
  container: css`
    display: flex;
    flex-direction: column;
    height: 412px;
    width: 480px;
    background: ${theme.colors.background.primary};
    box-shadow: ${theme.shadows.z3};
  `,
  description: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.xs};
    opacity: 50%;
  `,
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
