import { SegmentAsync } from '@grafana/ui';
import React, { useCallback, useMemo } from 'react';
import { debounce } from 'lodash';
import { PromVisualQuery } from './types';

export interface Props {
  query: PromVisualQuery;
}

export function MetricSelect({ query }: Props) {
  const loadOptions = useCallback((value: string | undefined) => {
    return Promise.resolve([
      { value: 'My metric', label: 'My metric' },
      { value: 'Another metric', label: 'Another metric' },
    ]);
  }, []);

  const debouncedLoadOptions = useMemo(() => debounce(loadOptions, 200, { leading: true }), [loadOptions]);

  return (
    <SegmentAsync<string>
      value={query.metric ?? 'Select metric'}
      inputMinWidth={150}
      loadOptions={debouncedLoadOptions}
      reloadOptionsOnChange={true}
      onChange={() => {}}
    />
  );
}
