import React from 'react';
import { AsyncSelect, Select } from '@grafana/ui';
import { toOption } from '@grafana/data';
import { PromLabelFilter, PromVisualQuery } from '../types';
import { PrometheusDatasource } from '../../datasource';
import AccessoryButton from 'app/plugins/datasource/cloudwatch/components/ui/AccessoryButton';
import InputGroup from 'app/plugins/datasource/cloudwatch/components/ui/InputGroup';

export interface Props {
  item: Partial<PromLabelFilter>;
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (value: PromLabelFilter) => void;
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
              onChange(({ ...item, label: change.label, value: undefined } as any) as PromLabelFilter);
            }
          }}
        />

        <Select
          value={toOption(item.op ?? '=')}
          options={operators}
          width="auto"
          onChange={(change) => {
            if (change.value != null) {
              onChange(({ ...item, op: change.value } as any) as PromLabelFilter);
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
              onChange(({ ...item, value: change.value } as any) as PromLabelFilter);
            }
          }}
        />
        <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
      </InputGroup>
    </div>
  );
}
