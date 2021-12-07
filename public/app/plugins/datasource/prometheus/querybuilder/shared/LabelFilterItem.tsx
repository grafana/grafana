import React, { useState } from 'react';
import { AsyncSelect, Select } from '@grafana/ui';
import { SelectableValue, toOption } from '@grafana/data';
import AccessoryButton from 'app/plugins/datasource/cloudwatch/components/ui/AccessoryButton';
import InputGroup from 'app/plugins/datasource/cloudwatch/components/ui/InputGroup';
import { QueryBuilderLabelFilter } from './types';

export interface Props {
  item: Partial<QueryBuilderLabelFilter>;
  onChange: (value: QueryBuilderLabelFilter) => void;
  onGetLabelNames: () => Promise<string[]>;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
  onDelete: () => void;
}

export function LabelFilterItem({ item, onChange, onDelete, onGetLabelNames, onGetLabelValues }: Props) {
  const [labelValues, setLabelValues] = useState<any>();

  const loadLabelNames = async () => {
    return (await onGetLabelNames()).map((value) => ({ label: value, value }));
  };

  const loadLabelValues = async (change: SelectableValue<string>) => {
    await onGetLabelValues(change).then((res) => {
      if (res.length > 0) {
        onChange(({ ...item, label: change.label, value: res[0] } as any) as QueryBuilderLabelFilter);
        setLabelValues(res.map((value) => ({ label: value, value })));
      }
    });
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
          defaultOptions={true}
          loadOptions={loadLabelNames}
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
