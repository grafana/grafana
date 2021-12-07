import React, { useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue, toOption } from '@grafana/data';
import { QueryBuilderLabelFilter } from './types';
import { AccessoryButton, InputGroup } from '@grafana/experimental';

export interface Props {
  item: Partial<QueryBuilderLabelFilter>;
  labelData: any;
  onChange: (value: QueryBuilderLabelFilter) => void;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
  onDelete: () => void;
}

export function LabelFilterItem({ item, labelData, onChange, onDelete, onGetLabelValues }: Props) {
  const [labelValues, setLabelValues] = useState<any>();

  const loadLabelValues = async (change: SelectableValue<string>) => {
    await onGetLabelValues(change).then((res) => {
      if (res.length > 0) {
        onChange(({ ...item, label: change.label, value: res[0] } as any) as QueryBuilderLabelFilter);
        setLabelValues(res.map((value) => ({ label: value, value })));
      }
    });
  };

  const getLabelNames = (labelData: any) => {
    return labelData ? Object.keys(labelData).map((value) => ({ label: value, value })) : [{ label: '', value: '' }];
  };

  const operators = [{ label: '=~', value: '=~' }];

  return (
    <div data-testid="prometheus-dimensions-filter-item">
      <InputGroup>
        <Select
          inputId="prometheus-dimensions-filter-item-key"
          width="auto"
          value={item.label ? toOption(item.label) : null}
          allowCustomValue
          options={getLabelNames(labelData)}
          onChange={(change) => {
            if (change.label) {
              onChange(({
                ...item,
                label: change.label,
                value: undefined,
              } as any) as QueryBuilderLabelFilter);
              loadLabelValues(change);
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
          options={labelValues}
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
