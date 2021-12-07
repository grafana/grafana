import React, { useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue, toOption } from '@grafana/data';
import { QueryBuilderLabelFilter } from './types';
import { AccessoryButton, InputGroup } from '@grafana/experimental';

export interface Props {
  item: Partial<QueryBuilderLabelFilter>;
  onChange: (value: QueryBuilderLabelFilter) => void;
  onGetLabelNames: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
  onDelete: () => void;
}

export function LabelFilterItem({ item, onChange, onDelete, onGetLabelNames, onGetLabelValues }: Props) {
  const [state, setState] = useState<{
    labelNames?: Array<SelectableValue<any>>;
    labelValues?: Array<SelectableValue<any>>;
    isLoading?: boolean;
  }>({});

  return (
    <div data-testid="prometheus-dimensions-filter-item">
      <InputGroup>
        <Select
          inputId="prometheus-dimensions-filter-item-key"
          width="auto"
          value={item.label ? toOption(item.label) : null}
          allowCustomValue
          onOpenMenu={async () => {
            setState({ isLoading: true });
            const labelNames = (await onGetLabelNames(item)).map((x) => ({ label: x, value: x }));
            setState({ labelNames, isLoading: undefined });
          }}
          isLoading={state.isLoading}
          options={state.labelNames}
          onChange={(change) => {
            if (change.label) {
              onChange(({
                ...item,
                label: change.label,
              } as any) as QueryBuilderLabelFilter);
            }
          }}
        />

        <Select
          value={toOption(item.op ?? '=')}
          options={operators}
          width="auto"
          onChange={(change) => {
            if (change.value != null) {
              onChange(({ ...item, op: change.value } as any) as QueryBuilderLabelFilter);
            }
          }}
        />

        <Select
          inputId="prometheus-dimensions-filter-item-value"
          width="auto"
          value={item.value ? toOption(item.value) : null}
          allowCustomValue
          options={state.labelValues}
          onOpenMenu={async () => {
            const res = await onGetLabelValues(item);
            setState({ ...state, labelValues: res.map((value) => ({ label: value, value })) });
          }}
          onChange={(change) => {
            if (change.value != null) {
              onChange(({ ...item, value: change.value } as any) as QueryBuilderLabelFilter);
            }
          }}
        />
        <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
      </InputGroup>
    </div>
  );
}

const operators = [
  { label: '=~', value: '=~' },
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
];
