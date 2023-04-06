import React, { useMemo, useState, useCallback } from 'react';

import { DataFrame, getFrameDisplayName, FieldMatcherID, fieldMatchers, SelectableValue } from '@grafana/data';

import { Select } from '../Select/Select';

import { FieldMatcherUIRegistryItem, MatcherUIProps } from './types';

const recoverRefIdMissing = (
  newRefIds: SelectableValue[],
  oldRefIds: SelectableValue[],
  previousValue: string | undefined
): SelectableValue | undefined => {
  if (!previousValue) {
    return;
  }
  // Previously selected value is missing from the new list.
  // Find the value that is in the new list but isn't in the old list
  let changedTo = newRefIds.find((refId) => {
    return !oldRefIds.some((refId2) => {
      return refId === refId2;
    });
  });
  if (changedTo) {
    // Found the new value, we assume the old value changed to this one, so we'll use it
    return changedTo;
  }
  return;
};

export interface Props {
  value?: string; // refID
  data: DataFrame[];
  onChange: (value: string) => void;
  placeholder?: string;
}

// Not exported globally... but used in grafana core
export function RefIDPicker({ value, data, onChange, placeholder }: Props) {
  const listOfRefIds = useMemo(() => getListOfQueryRefIds(data), [data]);

  const [priorSelectionState, updatePriorSelectionState] = useState<{
    refIds: SelectableValue[];
    value: string | undefined;
  }>({
    refIds: [],
    value: undefined,
  });

  const currentValue = useMemo(() => {
    return (
      listOfRefIds.find((refId) => refId.value === value) ??
      recoverRefIdMissing(listOfRefIds, priorSelectionState.refIds, priorSelectionState.value)
    );
  }, [value, listOfRefIds, priorSelectionState]);

  const onFilterChange = useCallback(
    (v: SelectableValue<string>) => {
      onChange(v.value!);
    },
    [onChange]
  );

  if (listOfRefIds !== priorSelectionState.refIds || currentValue?.value !== priorSelectionState.value) {
    updatePriorSelectionState({
      refIds: listOfRefIds,
      value: currentValue?.value,
    });
  }
  return (
    <Select
      options={listOfRefIds}
      onChange={onFilterChange}
      isClearable={true}
      placeholder={placeholder ?? 'Select query refId'}
      value={currentValue}
    />
  );
}

function getListOfQueryRefIds(data: DataFrame[]): Array<SelectableValue<string>> {
  const queries = new Map<string, DataFrame[]>();

  for (const frame of data) {
    const refId = frame.refId ?? '';
    const frames = queries.get(refId) ?? [];

    if (frames.length === 0) {
      queries.set(refId, frames);
    }

    frames.push(frame);
  }

  const values: Array<SelectableValue<string>> = [];

  for (const [refId, frames] of queries.entries()) {
    values.push({
      value: refId,
      label: `Query: ${refId ?? '(missing refId)'}`,
      description: getFramesDescription(frames),
    });
  }

  return values;
}

function getFramesDescription(frames: DataFrame[]): string {
  return `Frames (${frames.length}):
    ${frames
      .slice(0, Math.min(3, frames.length))
      .map((x) => getFrameDisplayName(x))
      .join(', ')} ${frames.length > 3 ? '...' : ''}`;
}

/**
 * Registry item for UI to configure "fields by frame refId"-matcher.
 * @public
 */
export const fieldsByFrameRefIdItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byFrameRefID,
  component: (props: MatcherUIProps<string>) => {
    return <RefIDPicker value={props.options} data={props.data} onChange={props.onChange} />;
  },
  matcher: fieldMatchers.get(FieldMatcherID.byFrameRefID),
  name: 'Fields returned by query',
  description: 'Set properties for fields from a specific query',
  optionsToLabel: (options) => options,
};
