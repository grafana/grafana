import React, { useCallback } from 'react';
import { Button, Select, Input, HorizontalGroup, VerticalGroup, InlineLabel } from '@grafana/ui';

import { Field } from '../Field';
import { findOption } from '../../utils/common';
import { AzureMetricDimension, AzureMonitorOption, AzureQueryEditorFieldProps } from '../../types';

interface DimensionFieldsProps extends AzureQueryEditorFieldProps {
  dimensionOptions: AzureMonitorOption[];
}

const DimensionFields: React.FC<DimensionFieldsProps> = ({ query, dimensionOptions, onQueryChange }) => {
  const setDimensionFilters = useCallback(
    (newFilters: AzureMetricDimension[]) => {
      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          dimensionFilters: newFilters,
        },
      });
    },
    [onQueryChange, query]
  );

  const addFilter = useCallback(() => {
    setDimensionFilters([
      ...query.azureMonitor.dimensionFilters,
      {
        dimension: '',
        operator: 'eq',
        filter: '',
      },
    ]);
  }, [query.azureMonitor.dimensionFilters, setDimensionFilters]);

  const removeFilter = (index: number) => {
    const newFilters = [...query.azureMonitor.dimensionFilters];
    newFilters.splice(index, 1);
    setDimensionFilters(newFilters);
  };

  const onFieldChange = <Key extends keyof AzureMetricDimension>(
    filterIndex: number,
    fieldName: Key,
    value: AzureMetricDimension[Key]
  ) => {
    const newFilters = [...query.azureMonitor.dimensionFilters];
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
        {query.azureMonitor.dimensionFilters.map((filter, index) => (
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
