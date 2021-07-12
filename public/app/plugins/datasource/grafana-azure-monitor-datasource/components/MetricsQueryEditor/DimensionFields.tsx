import React, { useCallback, useMemo } from 'react';
import { Button, Select, Input, HorizontalGroup, VerticalGroup, InlineLabel } from '@grafana/ui';

import { Field } from '../Field';
import { findOption } from '../../utils/common';
import { AzureMetricDimension, AzureMonitorOption, AzureQueryEditorFieldProps } from '../../types';
import { setDimensionFilters as setQueryDimensionFilters } from './setQueryValue';

interface DimensionFieldsProps extends AzureQueryEditorFieldProps {
  dimensionOptions: AzureMonitorOption[];
}

const DimensionFields: React.FC<DimensionFieldsProps> = ({ query, dimensionOptions, onQueryChange }) => {
  const dimensionFilters = useMemo(() => query.azureMonitor?.dimensionFilters ?? [], [
    query.azureMonitor?.dimensionFilters,
  ]);

  const setDimensionFilters = (newFilters: AzureMetricDimension[]) => {
    const newQuery = setQueryDimensionFilters(query, newFilters);
    onQueryChange(newQuery);
  };

  const addFilter = () => {
    // TODO: move this to setQueryValue
    setDimensionFilters([
      ...dimensionFilters,
      {
        dimension: '',
        operator: 'eq',
        filter: '',
      },
    ]);
  };

  const removeFilter = (index: number) => {
    // TODO: move this to setQueryValue
    const newFilters = [...dimensionFilters];
    newFilters.splice(index, 1);
    setDimensionFilters(newFilters);
  };

  const onFieldChange = <Key extends keyof AzureMetricDimension>(
    filterIndex: number,
    fieldName: Key,
    value: AzureMetricDimension[Key]
  ) => {
    const newFilters = [...dimensionFilters];
    const newFilter = newFilters[filterIndex];
    newFilter[fieldName] = value;
    setDimensionFilters(newFilters);
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
              placeholder="Field"
              value={findOption(dimensionOptions, filter.dimension)}
              options={dimensionOptions}
              onChange={(v) => onFieldChange(index, 'dimension', v.value ?? '')}
              width={38}
            />
            <InlineLabel aria-label="equals">==</InlineLabel>
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
