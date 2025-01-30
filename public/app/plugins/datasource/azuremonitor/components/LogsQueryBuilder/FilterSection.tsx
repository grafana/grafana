import { css } from '@emotion/css';
import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Input, Label, Select, useStyles2 } from '@grafana/ui';

import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { toOperatorOptions, valueToDefinition } from './utils';

interface FilterSectionProps {
  columns: AzureLogAnalyticsMetadataColumn[];
  selectedColumns: SelectableValue<string>;
  query: AzureMonitorQuery;
  onChange: (query: AzureMonitorQuery) => void;
} 

export const FilterSection: React.FC<FilterSectionProps> = ({
  query,
  onChange,
  columns,
  selectedColumns
 }) => {
  const [filters, setFilters] = useState<Array<{ column: string; operator: string; value: string }>>([]);
  const styles = useStyles2(getStyles);
  console.log("selectedColumns", selectedColumns)


  const updateQueryWithFilters = () => {
    const validFilters = filters.filter((f) => f.column && f.operator && f.value);

    if (validFilters.length === 0) {
      return; 
    }

    let baseQuery = query.azureLogAnalytics?.query || '';
    let filterClause = validFilters.map((f) => `${f.column} ${f.operator} '${f.value}'`).join(' and ');

    baseQuery = baseQuery.includes('| where')
      ? baseQuery.replace(/(\| where .*)/, `| where ${filterClause}`)
      : `${baseQuery} | where ${filterClause}`;

    onChange({
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        query: baseQuery,
      },
    });
  };

  const onChangeFilter = (index: number, key: keyof typeof filters[0], value: string) => {
    const updatedFilters = [...filters];
    updatedFilters[index] = { ...updatedFilters[index], [key]: value };
    setFilters(updatedFilters);
  };

  const onDeleteFilter = (index: number) => {
    const updatedFilters = filters.filter((_, i) => i !== index);
    setFilters(updatedFilters);
  };

  return (
    <>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField label="Filters" optional={true}>
            <>
              {filters.length > 0 && (
                <div className={styles.filters}>
                  {filters.map((filter, index) => (
                    <InputGroup key={index}>
                      <Select
                        aria-label="column"
                        width={30}
                        value={filter.column ? valueToDefinition(filter.column) : null}
                        options={Array.isArray(selectedColumns) ? selectedColumns : [selectedColumns]}  
                        onChange={(e) => e.value && onChangeFilter(index, 'column', e.value)}
                      />
                      <Select
                        aria-label="operator"
                        width={12}
                        value={{ label: filter.operator, value: filter.operator }}
                        options={toOperatorOptions('string')}
                        onChange={(e) => e.value && onChangeFilter(index, 'operator', e.value)}
                      />
                      <Input
                        aria-label="column value"
                        value={filter.value}
                        onChange={(e) => {
                          onChangeFilter(index, 'value', e.currentTarget.value)
                          updateQueryWithFilters();
                        }}
                        width={30}
                      />
                      <Button variant="secondary" icon="times" onClick={() => onDeleteFilter(index)} />
                      {index < filters.length - 1 ? <Label>AND</Label> : undefined}
                    </InputGroup>
                  ))}
                </div>
              )}
              <Button
                variant="secondary"
                onClick={() => setFilters([...filters, { column: '', operator: '==', value: '' }])}
              >
                Add Filter
              </Button>
            </>
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>
    </>
  );
};

const getStyles = () => ({
  filters: css({ marginBottom: '8px' }),
});

