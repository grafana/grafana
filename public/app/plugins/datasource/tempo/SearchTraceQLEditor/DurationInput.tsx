import React from 'react';

import { Select, HorizontalGroup, Input } from '@grafana/ui';

import { TraceqlFilter } from '../dataquery.gen';

interface Props {
  filter: TraceqlFilter;
  updateFilter: (f: TraceqlFilter) => void;
  isTagsLoading?: boolean;
  operators: string[];
}
const DurationInput = ({ filter, operators, updateFilter }: Props) => {
  return (
    <HorizontalGroup spacing={'xs'}>
      <Select
        inputId={`${filter.id}-operator`}
        options={operators.map((op) => ({ label: op, value: op }))}
        value={filter.operator}
        onChange={(v) => {
          updateFilter({ ...filter, operator: v?.value });
        }}
        isClearable={false}
        aria-label={`select ${filter.id} operator`}
        allowCustomValue={true}
        width={8}
      />
      <Input
        value={filter.value}
        onChange={(v) => {
          updateFilter({ ...filter, value: v.currentTarget.value });
        }}
        placeholder="e.g. 100ms, 1.2s"
        aria-label={`select ${filter.id} value`}
        width={18}
      />
    </HorizontalGroup>
  );
};

export default DurationInput;
