import React, { useState, useEffect } from 'react';

import { Select, HorizontalGroup, Input } from '@grafana/ui';

import { SearchFilter } from '../types';

interface Props {
  id: string;
  updateFilter: (f: SearchFilter) => void;
  isTagsLoading?: boolean;
  tag?: string;
  operators: string[];
}
const DurationInput = ({ id, tag, operators, updateFilter }: Props) => {
  const [filter, setFilter] = useState<SearchFilter>({ id, type: 'static', tag, operator: operators[0] });

  useEffect(() => {
    updateFilter(filter);
  }, [updateFilter, filter]);

  return (
    <HorizontalGroup spacing={'xs'}>
      <Select
        inputId={`${id}-operator`}
        options={operators.map((op) => ({ label: op, value: op }))}
        value={filter.operator}
        onChange={(v) => {
          setFilter({ ...filter, operator: v?.value });
        }}
        isClearable={false}
        aria-label={`select-${id}-operator`}
        allowCustomValue={true}
        width={8}
      />
      <Input
        value={filter.value}
        onChange={(v) => {
          setFilter({ ...filter, value: v.currentTarget.value });
        }}
        placeholder="e.g. 100ms, 1.2s"
        aria-label={`select-${id}-value`}
        width={18}
      />
    </HorizontalGroup>
  );
};

export default DurationInput;
