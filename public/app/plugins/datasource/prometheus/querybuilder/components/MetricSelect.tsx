import { AsyncSelect } from '@grafana/ui';
import React from 'react';
import { PromVisualQuery } from '../types';
import { toOption } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';

export interface Props {
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  onGetMetrics: () => Promise<string[]>;
}

export function MetricSelect({ query, onChange, onGetMetrics }: Props) {
  const loadMetrics = async () => {
    return await onGetMetrics().then((res) => {
      return res.map((value) => ({ label: value, value }));
    });
  };

  return (
    <EditorFieldGroup>
      <EditorField label="Metric">
        <AsyncSelect
          value={query.metric ? toOption(query.metric) : undefined}
          placeholder="Select metric"
          allowCustomValue
          defaultOptions={true}
          loadOptions={loadMetrics}
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
