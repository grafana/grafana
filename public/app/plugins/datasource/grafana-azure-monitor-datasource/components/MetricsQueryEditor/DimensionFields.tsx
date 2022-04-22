import React, { useMemo } from 'react';
import { Button, Select, Input, HorizontalGroup, VerticalGroup, MultiSelect } from '@grafana/ui';

import { Field } from '../Field';
import { AzureMetricDimension, AzureMonitorOption, AzureQueryEditorFieldProps } from '../../types';
import { appendDimensionFilter, removeDimensionFilter, setDimensionFilterValue } from './setQueryValue';
import { SelectableValue, Labels, DataFrame } from '@grafana/data';

interface DimensionFieldsProps extends AzureQueryEditorFieldProps {
  dimensionOptions: AzureMonitorOption[];
}

interface DimensionLabels {
  [key: string]: Set<string>;
}

const DimensionFields: React.FC<DimensionFieldsProps> = ({ data, query, dimensionOptions, onQueryChange }) => {
  const dimensionFilters = useMemo(
    () => query.azureMonitor?.dimensionFilters ?? [],
    [query.azureMonitor?.dimensionFilters]
  );

  const dimensionLabels = useMemo(() => {
    let labelsObj: DimensionLabels = {};
    if (data?.series.length) {
      const series: DataFrame[] = data.series.flat();
      const fields = series.flatMap((item) => item.fields);
      const labels = fields
        .map((item) => item.labels)
        .flat()
        .filter((item) => item!);
      for (const label of labels) {
        if (label) {
          for (const [dimension, value] of Object.entries(label)) {
            if (labelsObj[dimension]) {
              labelsObj[dimension].add(value);
            } else {
              labelsObj[dimension] = new Set([value]);
            }
          }
        }
      }
    }
    return labelsObj;
  }, [dimensionFilters]);

  const dimensionOperators: Array<SelectableValue<string>> = [
    { label: '==', value: 'eq' },
    { label: '!=', value: 'ne' },
    { label: 'starts with', value: 'sw' },
  ];

  const validDimensionOptions = useMemo(() => {
    // We filter out any dimensions that have already been used in a filter as the API doesn't support having multiple filters with the same dimension name.
    // The Azure portal also doesn't support this feature so it makes sense for consistency.
    let t = dimensionOptions;
    if (dimensionFilters.length) {
      t = dimensionOptions.filter(
        (val) => !dimensionFilters.some((dimensionFilter) => dimensionFilter.dimension === val.value)
      );
    }
    return t;
  }, [dimensionFilters, dimensionOptions]);

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
      onFieldChange(index, 'filter', [ev.target.value]);
    }
  };

  const onMultiSelectFilterChange = (index: number, v: SelectableValue<string>[]) => {
    onFieldChange(
      index,
      'filter',
      v.map((item) => item.value!)
    );
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
            {filter.operator === 'eq' || filter.operator === 'ne' ? (
              <MultiSelect
                menuShouldPortal
                placeholder="Select or add value(s)"
                value={filter.filter}
                options={[...(dimensionLabels[filter.dimension.toLowerCase()] ?? [])].map((item) => ({
                  value: item,
                  label: item,
                }))}
                onChange={(v) => onMultiSelectFilterChange(index, v)}
              />
            ) : (
              <Input placeholder="" value={filter.filter} onChange={(ev) => onFilterInputChange(index, ev)} />
            )}

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
