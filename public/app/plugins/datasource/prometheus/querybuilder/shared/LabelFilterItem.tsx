import React from 'react';
import { AsyncSelect, Select } from '@grafana/ui';
import { toOption } from '@grafana/data';
import AccessoryButton from 'app/plugins/datasource/cloudwatch/components/ui/AccessoryButton';
import InputGroup from 'app/plugins/datasource/cloudwatch/components/ui/InputGroup';
import { QueryBuilderLabelFilter } from './types';

export interface Props {
  item: Partial<QueryBuilderLabelFilter>;
  onChange: (value: QueryBuilderLabelFilter) => void;
  onDelete: () => void;
}

export function LabelFilterItem({ item, onChange, onDelete }: Props) {
  const loadLabelKeys = async () => {
    return Promise.resolve([{ label: 'Aasd', value: 'asd' }]);
  };

  const operators = [{ label: '=~', value: '=~' }];

  return (
    <div data-testid="prometheus-dimensions-filter-item">
      <InputGroup>
        <AsyncSelect
          inputId="prometheus-dimensions-filter-item-key"
          width="auto"
          value={item.label ? toOption(item.label) : null}
          allowCustomValue
          loadOptions={loadLabelKeys}
          onChange={(change) => {
            if (change.label) {
              onChange(({ ...item, label: change.label, value: undefined } as any) as QueryBuilderLabelFilter);
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

        <AsyncSelect
          inputId="prometheus-dimensions-filter-item-value"
          width="auto"
          value={item.value ? toOption(item.value) : null}
          allowCustomValue
          loadOptions={loadLabelKeys}
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
