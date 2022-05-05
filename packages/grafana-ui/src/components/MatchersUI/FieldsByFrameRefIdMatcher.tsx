import React, { memo, useMemo, useCallback } from 'react';

import { FieldMatcherID, fieldMatchers, SelectableValue, DataFrame } from '@grafana/data';

import { Select } from '../Select/Select';

import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';

/**
 * UI to configure "fields by frame refId"-matcher.
 * @public
 */
export const FieldsByFrameRefIdMatcher = memo<MatcherUIProps<string>>((props) => {
  const { data, options, onChange: onChangeFromProps } = props;
  const referenceIDs = useFrameRefIds(data);
  const selectOptions = useSelectOptions(referenceIDs);

  const onChange = useCallback(
    (selection: SelectableValue<string>) => {
      if (!selection.value || !referenceIDs.has(selection.value)) {
        return;
      }
      return onChangeFromProps(selection.value);
    },
    [referenceIDs, onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return <Select value={selectedOption} options={selectOptions} onChange={onChange} />;
});

FieldsByFrameRefIdMatcher.displayName = 'FieldsByFrameRefIdMatcher';

/**
 * Registry item for UI to configure "fields by frame refId"-matcher.
 * @public
 */
export const fieldsByFrameRefIdItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byFrameRefID,
  component: FieldsByFrameRefIdMatcher,
  matcher: fieldMatchers.get(FieldMatcherID.byFrameRefID),
  name: 'Fields returned by query',
  description: 'Set properties for fields from a specific query',
  optionsToLabel: (options) => options,
};

const useFrameRefIds = (data: DataFrame[]): Set<string> => {
  return useMemo(() => {
    const refIds: Set<string> = new Set();

    for (const frame of data) {
      if (frame.refId) {
        refIds.add(frame.refId);
      }
    }

    return refIds;
  }, [data]);
};

const useSelectOptions = (displayNames: Set<string>): Array<SelectableValue<string>> => {
  return useMemo(() => {
    return Array.from(displayNames).map((n) => ({
      value: n,
      label: n,
    }));
  }, [displayNames]);
};
