import React, { useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue, toOption } from '@grafana/data';
import { QueryBuilderLabelFilter } from './types';
import { AccessoryButton, InputGroup } from '@grafana/experimental';

export interface Props {
  defaultOp: string;
  item: Partial<QueryBuilderLabelFilter>;
  onChange: (value: QueryBuilderLabelFilter) => void;
  onGetLabelNames: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
  onDelete: () => void;
}

export function LabelFilterItem({ item, defaultOp, onChange, onDelete, onGetLabelNames, onGetLabelValues }: Props) {
  const [state, setState] = useState<{
    labelNames?: Array<SelectableValue<any>>;
    labelValues?: Array<SelectableValue<any>>;
    isLoadingLabelNames?: boolean;
    isLoadingLabelValues?: boolean;
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
            setState({ isLoadingLabelNames: true });
            const labelNames = (await onGetLabelNames(item)).map((x) => ({ label: x, value: x }));
            setState({ labelNames, isLoadingLabelNames: undefined });
          }}
          isLoading={state.isLoadingLabelNames}
          options={state.labelNames}
          onChange={(change) => {
            if (change.label) {
              onChange(({
                ...item,
                op: item.op ?? defaultOp,
                label: change.label,
              } as any) as QueryBuilderLabelFilter);
            }
          }}
        />

        <Select
          value={toOption(item.op ?? defaultOp)}
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
          onOpenMenu={async () => {
            setState({ isLoadingLabelValues: true });
            const labelValues = await onGetLabelValues(item);
            setState({
              ...state,
              labelValues: labelValues.map((value) => ({ label: value, value })),
              isLoadingLabelValues: undefined,
            });
          }}
          isLoading={state.isLoadingLabelValues}
          options={state.labelValues}
          onChange={(change) => {
            if (change.value != null) {
              onChange(({ ...item, value: change.value, op: item.op ?? defaultOp } as any) as QueryBuilderLabelFilter);
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
