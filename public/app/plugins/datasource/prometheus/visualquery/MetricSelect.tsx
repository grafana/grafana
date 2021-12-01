import { SegmentAsync } from '@grafana/ui';
import React, { useCallback, useMemo } from 'react';
import { debounce } from 'lodash';

export interface Props {}

export function MetricSelect(props: Props) {
  const loadOptions = useCallback((value: string | undefined) => {
    return Promise.resolve([{ value: 'My metric' }, { value: 'Another metric' }]);
  }, []);

  const debouncedLoadOptions = useMemo(() => debounce(loadOptions, 200, { leading: true }), [loadOptions]);

  return (
    <SegmentAsync<string>
      value={'Select metric'}
      inputMinWidth={150}
      loadOptions={debouncedLoadOptions}
      reloadOptionsOnChange={true}
      onChange={() => {}}
    />
  );
}
