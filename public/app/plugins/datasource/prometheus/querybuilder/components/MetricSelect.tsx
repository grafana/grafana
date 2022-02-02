import { Select } from '@grafana/ui';
import React, { useState } from 'react';
import { PromVisualQuery } from '../types';
import { SelectableValue, toOption } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { css } from '@emotion/css';

export interface Props {
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  onGetMetrics: () => Promise<string[]>;
}

export function MetricSelect({ query, onChange, onGetMetrics }: Props) {
  const styles = getStyles();
  const [state, setState] = useState<{
    metrics?: Array<SelectableValue<any>>;
    isLoading?: boolean;
  }>({});

  const loadMetrics = async () => {
    return await onGetMetrics().then((res) => {
      return res.map((value) => ({ label: value, value }));
    });
  };

  return (
    <EditorFieldGroup>
      <EditorField label="Metric">
        <Select
          inputId="prometheus-metric-select"
          className={styles.select}
          value={query.metric ? toOption(query.metric) : undefined}
          placeholder="Select metric"
          allowCustomValue
          onOpenMenu={async () => {
            setState({ isLoading: true });
            const metrics = await loadMetrics();
            setState({ metrics, isLoading: undefined });
          }}
          isLoading={state.isLoading}
          options={state.metrics}
          onChange={({ value }) => {
            if (value) {
              onChange({ ...query, metric: value, labels: [] });
            }
          }}
        />
      </EditorField>
    </EditorFieldGroup>
  );
}

const getStyles = () => ({
  select: css`
    min-width: 125px;
  `,
});
