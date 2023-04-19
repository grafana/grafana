import React, { useEffect, useMemo, useState } from 'react';

import { SelectableValue, DataFrame, PanelData, Labels } from '@grafana/data';
import { EditorList, AccessoryButton } from '@grafana/experimental';
import { Select, HorizontalGroup, MultiSelect } from '@grafana/ui';

import { AzureMetricDimension, AzureMonitorOption, AzureMonitorQuery, AzureQueryEditorFieldProps } from '../../types';
import { Field } from '../Field';

import { setDimensionFilters } from './setQueryValue';

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
        .filter((item): item is Labels => item !== null && item !== undefined);
      for (const label of labels) {
        // Labels only exist for series that have a dimension selected
        for (const [dimension, value] of Object.entries(label)) {
          const dimensionLower = dimension.toLowerCase();
          if (labelsObj[dimensionLower]) {
            labelsObj[dimensionLower].add(value);
          } else {
            labelsObj[dimensionLower] = new Set([value]);
          }
        }
      }
    }
    setDimensionLabels((prevLabels) => {
      const newLabels: DimensionLabels = {};
      const currentLabels = Object.keys(labelsObj);
      if (currentLabels.length === 0) {
        return prevLabels;
      }
      for (const label of currentLabels) {
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

  const onFieldChange = <Key extends keyof AzureMetricDimension>(
    fieldName: Key,
    item: Partial<AzureMetricDimension>,
    value: AzureMetricDimension[Key],
    onChange: (item: Partial<AzureMetricDimension>) => void
  ) => {
    item[fieldName] = value;
    onChange(item);
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

  const getValidMultiSelectOptions = (selectedFilters: string[] | undefined, dimension: string) => {
    const labelOptions = getValidFilterOptions(undefined, dimension);
    if (selectedFilters) {
      for (const filter of selectedFilters) {
        if (!labelOptions.find((label) => label.value === filter)) {
          labelOptions.push({ value: filter, label: filter });
        }
      }
    }
    return labelOptions;
  };
  const getValidOperators = (selectedOperator: string) => {
    if (dimensionOperators.find((operator: SelectableValue) => operator.value === selectedOperator)) {
      return dimensionOperators;
    }
    return [...dimensionOperators, ...(selectedOperator ? [{ label: selectedOperator, value: selectedOperator }] : [])];
  };

  const changedFunc = (changed: Array<Partial<AzureMetricDimension>>) => {
    const properData: AzureMetricDimension[] = changed.map((x) => {
      return {
        dimension: x.dimension ?? '',
        operator: x.operator ?? 'eq',
        filters: x.filters ?? [],
      };
    });
    onQueryChange(setDimensionFilters(query, properData));
  };

  const renderFilters = (
    item: Partial<AzureMetricDimension>,
    onChange: (item: Partial<AzureMetricDimension>) => void,
    onDelete: () => void
  ) => {
    return (
      <HorizontalGroup spacing="none">
        <Select
          menuShouldPortal
          placeholder="Field"
          value={item.dimension}
          options={getValidDimensionOptions(item.dimension || '')}
          onChange={(e) => onFieldChange('dimension', item, e.value ?? '', onChange)}
        />
        <Select
          menuShouldPortal
          placeholder="Operation"
          value={item.operator}
          options={getValidOperators(item.operator || 'eq')}
          onChange={(e) => onFieldChange('operator', item, e.value ?? '', onChange)}
          allowCustomValue
        />
        {item.operator === 'eq' || item.operator === 'ne' ? (
          <MultiSelect
            menuShouldPortal
            placeholder="Select value(s)"
            value={item.filters}
            options={getValidMultiSelectOptions(item.filters, item.dimension ?? '')}
            onChange={(e) =>
              onFieldChange(
                'filters',
                item,
                e.map((x) => x.value ?? ''),
                onChange
              )
            }
            aria-label={'dimension-labels-select'}
            allowCustomValue
          />
        ) : (
          // The API does not currently allow for multiple "starts with" clauses to be used.
          <Select
            menuShouldPortal
            placeholder="Select value"
            value={item.filters ? item.filters[0] : ''}
            allowCustomValue
            options={getValidFilterOptions(item.filters ? item.filters[0] : '', item.dimension ?? '')}
            onChange={(e) => onFieldChange('filters', item, [e?.value ?? ''], onChange)}
            isClearable
          />
        )}
        <AccessoryButton aria-label="Remove" icon="times" variant="secondary" onClick={onDelete} type="button" />
      </HorizontalGroup>
    );
  };

  return (
    <Field label="Dimensions">
      <EditorList items={dimensionFilters} onChange={changedFunc} renderItem={renderFilters} />
    </Field>
  );
};

export default DimensionFields;
