import React, { useCallback } from 'react';
import { Button, Select, Input, HorizontalGroup, VerticalGroup, InlineLabel } from '@grafana/ui';

import { MultipleFields } from '../Field';
import { findOption, MetricsQueryEditorFieldProps, Option } from '../common';

interface DimensionFieldsProps extends MetricsQueryEditorFieldProps {
  dimensionOptions: Option[];
}

const DimensionFields: React.FC<DimensionFieldsProps> = ({ query, dimensionOptions, onChange }) => {
  const addFilter = useCallback(() => {
    onChange('dimensionFilters', [
      ...query.azureMonitor.dimensionFilters,
      {
        dimension: '',
        operator: 'eq',
        filter: '',
      },
    ]);
  }, [query.azureMonitor.dimensionFilters]);

  const removeFilter = useCallback(
    (index) => {
      const newFilters = [...query.azureMonitor.dimensionFilters];
      newFilters.splice(index, 1);
      onChange('dimensionFilters', newFilters);
    },
    [query.azureMonitor.dimensionFilters]
  );

  return (
    <MultipleFields label="Dimension" labelWidth={16}>
      <VerticalGroup spacing="xs">
        {query.azureMonitor.dimensionFilters.map((filter, index) => (
          <HorizontalGroup key={index} spacing="xs">
            <Select
              placeholder="Field"
              value={findOption(dimensionOptions, filter.dimension)}
              options={dimensionOptions}
              onChange={() => {}}
            />
            <InlineLabel aria-label="equals">==</InlineLabel>
            <Input placeholder="" value={filter.filter} />
            <Button variant="secondary" size="md" icon="trash-alt" aria-label="Remove" onClick={removeFilter}></Button>
          </HorizontalGroup>
        ))}

        <Button variant="secondary" size="md" onClick={addFilter}>
          Add new dimension
        </Button>
      </VerticalGroup>
    </MultipleFields>
  );
};

export default DimensionFields;
