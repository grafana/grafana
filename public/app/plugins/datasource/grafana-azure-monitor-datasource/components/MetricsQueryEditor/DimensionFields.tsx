import React, { useMemo } from 'react';
import { Button, Select, Input, HorizontalGroup, VerticalGroup } from '@grafana/ui';

import { Field } from '../Field';
import { AzureMetricDimension, AzureMonitorOption, AzureQueryEditorFieldProps } from '../../types';
import { appendDimensionFilter, removeDimensionFilter, setDimensionFilterValue } from './setQueryValue';
import { SelectableValue } from '@grafana/data';

interface DimensionFieldsProps extends AzureQueryEditorFieldProps {
  dimensionOptions: AzureMonitorOption[];
}

const DimensionFields: React.FC<DimensionFieldsProps> = ({ query, dimensionOptions, onQueryChange }) => {
  const dimensionFilters = useMemo(
    () => query.azureMonitor?.dimensionFilters ?? [],
    [query.azureMonitor?.dimensionFilters]
  );

  const dimensionOperators: Array<SelectableValue<string>> = [
    { label: '==', value: 'eq' },
    { label: '!=', value: 'ne' },
    { label: 'starts with', value: 'sw' },
  ];

  const validDimensionOptions = useMemo(() => {
    let t = dimensionOptions;
    let dimensionFilters = query.azureMonitor?.dimensionFilters;
    if (dimensionFilters !== undefined && dimensionFilters.length > 0) {
      t = dimensionOptions.filter((val) => !dimensionFilters?.find((dimension) => dimension.dimension === val.value));
    }
    return t;
  }, [query.azureMonitor?.dimensionFilters, dimensionOptions]);

  const addFilter = () => {
    onQueryChange(appendDimensionFilter(query));
  };

  const removeFilter = (index: number) => {
    onQueryChange(removeDimensionFilter(query, index));
  };

  const onFieldChange = <Key extends keyof AzureMetricDimension>(
    filterIndex: number,
    fieldName: Key,
    value: AzureMetricDimension[Key]
  ) => {
    onQueryChange(setDimensionFilterValue(query, filterIndex, fieldName, value));
  };

  const onFilterInputChange = (index: number, ev: React.FormEvent) => {
    if (ev.target instanceof HTMLInputElement) {
      onFieldChange(index, 'filter', ev.target.value);
    }
  };

  return (
    <Field label="Dimension">
      <VerticalGroup spacing="xs">
        {dimensionFilters.map((filter, index) => (
          <HorizontalGroup key={index} spacing="xs">
            <Select
              menuShouldPortal
              placeholder="Field"
              value={filter.dimension}
              options={validDimensionOptions}
              onChange={(v) => onFieldChange(index, 'dimension', v.value ?? '')}
              width={38}
            />
            <Select
              menuShouldPortal
              placeholder="Operation"
              value={filter.operator}
              options={dimensionOperators}
              onChange={(v) => onFieldChange(index, 'operator', v.value ?? '')}
            />
            <Input placeholder="" value={filter.filter} onChange={(ev) => onFilterInputChange(index, ev)} />
            <Button
              variant="secondary"
              size="md"
              icon="trash-alt"
              aria-label="Remove"
              onClick={() => removeFilter(index)}
            ></Button>
          </HorizontalGroup>
        ))}

        <Button variant="secondary" size="md" onClick={addFilter}>
          Add new dimension
        </Button>
      </VerticalGroup>
    </Field>
  );
};

export default DimensionFields;
