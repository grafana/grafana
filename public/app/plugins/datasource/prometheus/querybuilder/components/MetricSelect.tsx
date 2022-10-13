import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import Highlighter from 'react-highlight-words';

import { SelectableValue, toOption, GrafanaTheme2 } from '@grafana/data';
import { Select, FormatOptionLabelMeta, useStyles2, EditorField, EditorFieldGroup } from '@grafana/ui';

import { useAppNotification } from '../../../../../core/copy/appNotification';
import { PromVisualQuery } from '../types';

// We are matching words split with space
const splitSeparator = ' ';
const MAX_NUMBER_OF_METRICS_TO_SAVE_TO_REACT_STATE = 10000;

export interface Props {
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  onGetMetrics: () => Promise<SelectableValue[]>;
}

export function MetricSelect({ query, onChange, onGetMetrics }: Props) {
  const styles = useStyles2(getStyles);
  const [state, setState] = useState<{
    metrics?: Array<SelectableValue<any>>;
    isLoading?: boolean;
    isOverLimit?: boolean;
    metricsLength?: number;
  }>({});

  const notifyApp = useAppNotification();

  useEffect(() => {
    const length = state?.metricsLength ?? 0;
    if (!state.isOverLimit || length < MAX_NUMBER_OF_METRICS_TO_SAVE_TO_REACT_STATE) {
      return;
    }

    notifyApp.warning(
      `Fetched ${length} metrics, only displaying first ${MAX_NUMBER_OF_METRICS_TO_SAVE_TO_REACT_STATE}.`
    );
  }, [state.isOverLimit, state.metricsLength, notifyApp]);

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

  return (
    <EditorFieldGroup>
      <EditorField label="Metric">
        <Select
          inputId="prometheus-metric-select"
          className={styles.select}
          value={query.metric ? toOption(query.metric) : undefined}
          placeholder="Select metric"
          virtualized
          allowCustomValue
          formatOptionLabel={formatOptionLabel}
          filterOption={customFilterOption}
          onOpenMenu={async () => {
            setState({ isLoading: true });
            const metrics = await onGetMetrics();
            const metricsLength = metrics.length;

            if (metrics.length > MAX_NUMBER_OF_METRICS_TO_SAVE_TO_REACT_STATE) {
              // Truncate the metrics array past the limit before trying to save to state, or we'll run out of memory
              metrics.splice(0, metrics.length - MAX_NUMBER_OF_METRICS_TO_SAVE_TO_REACT_STATE);
              setState({
                metrics,
                isLoading: undefined,
                isOverLimit: true,
                metricsLength,
              });
            } else {
              setState({ metrics, isLoading: undefined, isOverLimit: undefined, metricsLength: undefined });
            }
          }}
          isLoading={state.isLoading}
          options={state.metrics}
          onChange={({ value }) => {
            if (value) {
              onChange({ ...query, metric: value });
            }
          }}
        />
      </EditorField>
    </EditorFieldGroup>
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
});
