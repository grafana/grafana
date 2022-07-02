import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';

import { SelectableValue, toOption, GrafanaTheme2 } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { Select, FormatOptionLabelMeta, useStyles2 } from '@grafana/ui';

import { PromVisualQuery } from '../types';

// We are matching words split with space
const splitSeparator = ' ';

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

  return (
    <EditorFieldGroup>
      <EditorField label="Metric">
        <Select
          inputId="prometheus-metric-select"
          className={styles.select}
          value={query.metric ? toOption(query.metric) : undefined}
          placeholder="Select metric"
          allowCustomValue
          formatOptionLabel={formatOptionLabel}
          filterOption={customFilterOption}
          onOpenMenu={async () => {
            setState({ isLoading: true });
            const metrics = await onGetMetrics();
            setState({ metrics, isLoading: undefined });
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
