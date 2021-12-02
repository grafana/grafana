import { AsyncSelect } from '@grafana/ui';
import React, { useCallback, useMemo } from 'react';
import { debounce } from 'lodash';
import { PromVisualQuery } from '../types';
import EditorFieldGroup from 'app/plugins/datasource/cloudwatch/components/ui/EditorFieldGroup';
import EditorField from 'app/plugins/datasource/cloudwatch/components/ui/EditorField';
import { toOption } from '@grafana/data';

export interface Props {
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
}

export function MetricSelect({ query, onChange }: Props) {
  const loadOptions = useCallback((value: string | undefined) => {
    return Promise.resolve([
      { value: 'My metric', label: 'My metric' },
      { value: 'Another metric', label: 'Another metric' },
    ]);
  }, []);

  const debouncedLoadOptions = useMemo(() => debounce(loadOptions, 200, { leading: true }), [loadOptions]);

  return (
    <EditorFieldGroup>
      <EditorField label="Metric">
        <AsyncSelect
          value={query.metric ? toOption(query.metric) : undefined}
          placeholder="Select metric"
          allowCustomValue
          loadOptions={debouncedLoadOptions}
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
