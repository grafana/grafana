import React, { useEffect, useMemo, useState } from 'react';

import { SelectableValue, DataFrame, PanelData } from '@grafana/data';
import { Button, Select, HorizontalGroup, VerticalGroup } from '@grafana/ui';

import { AzureMetricDimension, AzureMonitorOption, AzureMonitorQuery, AzureQueryEditorFieldProps } from '../../types';
import { Field } from '../Field';

import { appendDimensionFilter, removeDimensionFilter, setDimensionFilterValue } from './setQueryValue';

interface DimensionFieldsProps extends AzureQueryEditorFieldProps {
  dimensionOptions: AzureMonitorOption[];
}

interface DimensionLabels {
  [key: string]: Set<string>;
}

const useDimensionLabels = (data: PanelData | undefined, query: AzureMonitorQuery) => {
  const [dimensionLabels, setDimensionLabels] = useState<DimensionLabels>({});
  useEffect(() => {
    let labelsObj: DimensionLabels = {};
    if (data?.series?.length) {
      // Identify which series' in the dataframe are relevant to the current query
      const series: DataFrame[] = data.series.flat().filter((series) => series.refId === query.refId);
      const fields = series.flatMap((series) => series.fields);
      // Retrieve labels for series fields
      const labels = fields
        .map((fields) => fields.labels)
        .flat()
        .filter((item) => item!);
      for (const label of labels) {
        // Labels only exist for series that have a dimension selected
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
    setDimensionLabels((prevLabels) => {
      const newLabels: DimensionLabels = {};
      for (const label of Object.keys(labelsObj)) {
        if (prevLabels[label] && labelsObj[label].size < prevLabels[label].size) {
          newLabels[label] = prevLabels[label];
        } else {
          newLabels[label] = labelsObj[label];
        }
      }
      return newLabels;
    });
  }, [data?.series, query.refId]);
  return dimensionLabels;
};

const DimensionFields: React.FC<DimensionFieldsProps> = ({ data, query, dimensionOptions, onQueryChange }) => {
  const dimensionFilters = useMemo(
    () => query.azureMonitor?.dimensionFilters ?? [],
    [query.azureMonitor?.dimensionFilters]
  );

  const dimensionLabels = useDimensionLabels(data, query);

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

  const onFilterInputChange = (index: number, v: SelectableValue<string> | null) => {
    onFieldChange(index, 'filter', v?.value ?? '');
  };

  const getValidDimensionOptions = (selectedDimension: string) => {
    return validDimensionOptions.concat(dimensionOptions.filter((item) => item.value === selectedDimension));
  };

  const getValidFilterOptions = (selectedFilter: string | undefined, dimension: string) => {
    const dimensionFilters = Array.from(dimensionLabels[dimension.toLowerCase()] ?? []);
    if (dimensionFilters.find((filter) => filter === selectedFilter)) {
      return dimensionFilters.map((filter) => ({ value: filter, label: filter }));
    }
    return [...dimensionFilters, ...(selectedFilter && selectedFilter !== '*' ? [selectedFilter] : [])].map((item) => ({
      value: item,
      label: item,
    }));
  };

  const getValidOperators = (selectedOperator: string) => {
    if (dimensionOperators.find((operator: SelectableValue) => operator.value === selectedOperator)) {
      return dimensionOperators;
    }
    return [...dimensionOperators, ...(selectedOperator ? [{ label: selectedOperator, value: selectedOperator }] : [])];
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
              options={getValidDimensionOptions(filter.dimension)}
              onChange={(v) => onFieldChange(index, 'dimension', v.value ?? '')}
              width={38}
            />
            <Select
              menuShouldPortal
              placeholder="Operation"
              value={filter.operator}
              options={getValidOperators(filter.operator)}
              onChange={(v) => onFieldChange(index, 'operator', v.value ?? '')}
              allowCustomValue
            />
            <Select
              menuShouldPortal
              placeholder="Select value"
              value={filter.filter ? filter.filter : ''}
              allowCustomValue
              options={getValidFilterOptions(filter.filter, filter.dimension)}
              onChange={(v) => onFilterInputChange(index, v)}
              isClearable
            />

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
