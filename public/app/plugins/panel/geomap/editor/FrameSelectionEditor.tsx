import React, { useCallback, useMemo, useState } from 'react';

import {
  FrameMatcherID,
  getFieldDisplayName,
  MatcherConfig,
  SelectableValue,
  StandardEditorProps,
} from '@grafana/data';
import { Select } from '@grafana/ui';

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

type Props = StandardEditorProps<MatcherConfig>;

export const FrameSelectionEditor = ({ value, context, onChange, item }: Props) => {
  const listOfRefId = useMemo(() => {
    return context.data.map((f) => ({
      value: f.refId ?? '',
      label: `Query: ${f.refId ?? '(missing refId)'} (size: ${f.length})`,
      description: f.fields.map((f) => getFieldDisplayName(f)).join(', '),
    }));
  }, [context.data]);

  const [priorSelectionState, updatePriorSelectionState] = useState<{
    refIds: SelectableValue[];
    value: string | undefined;
  }>({
    refIds: [],
    value: undefined,
  });

  const currentValue = useMemo(() => {
    return (
      listOfRefId.find((refId) => refId.value === value?.options) ??
      recoverRefIdMissing(listOfRefId, priorSelectionState.refIds, priorSelectionState.value)
    );
  }, [value, listOfRefId, priorSelectionState]);

  const onFilterChange = useCallback(
    (v: SelectableValue<string>) => {
      onChange(
        v?.value
          ? {
              id: FrameMatcherID.byRefId,
              options: v.value,
            }
          : undefined
      );
    },
    [onChange]
  );

  if (listOfRefId !== priorSelectionState.refIds || currentValue?.value !== priorSelectionState.value) {
    updatePriorSelectionState({
      refIds: listOfRefId,
      value: currentValue?.value,
    });
  }
  return (
    <Select
      options={listOfRefId}
      onChange={onFilterChange}
      isClearable={true}
      placeholder="Change filter"
      value={currentValue}
    />
  );
};
