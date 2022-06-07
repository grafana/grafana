import React, { FC, useCallback, useMemo } from 'react';
import { FrameMatcherID, getFieldDisplayName, MatcherConfig, SelectableValue, StandardEditorProps } from '@grafana/data';
import { Select } from '@grafana/ui';

export const FrameSelectionEditor: FC<StandardEditorProps<MatcherConfig>> = ({
  value,
  context,
  onChange,
  item,
}) => {
  const listOfRefId = useMemo(() => {
    return context.data.map(f => ({
      value: f.refId,
      label: `Query: ${f.refId} (size: ${f.length})`,
      description: f.fields.map(f => getFieldDisplayName(f)).join(', '),
    }));
  }, [context.data]);

  const currentValue = useMemo(() => {
    return listOfRefId.find((refId) => refId.value === value?.options) ?? null;
  }, [value, listOfRefId])

  const onFilterChange = useCallback((v: SelectableValue<string>) => {
    if (!v?.value) {
      onChange(undefined);
    } else {
      onChange({
        "id": FrameMatcherID.byRefId,
        "options": v.value
      })
    }
  }, []);


  return (
    <Select options={listOfRefId} onChange={onFilterChange} isClearable={true} placeholder="Change filter" value={currentValue}/>
  );
};
