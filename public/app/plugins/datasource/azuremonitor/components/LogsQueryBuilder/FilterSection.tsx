import { css } from '@emotion/css';
import React, { useState, useEffect, useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Input, Label, Select, useStyles2 } from '@grafana/ui';

import { AzureMonitorQuery } from '../../types';

import { formatKQLQuery, toOperatorOptions, valueToDefinition } from './utils';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

interface FilterSectionProps {
  selectedColumns: SelectableValue<string>;
  query: AzureMonitorQuery;
  onChange: (query: AzureMonitorQuery) => void;
}

export const FilterSection: React.FC<FilterSectionProps> = ({ query, onChange, selectedColumns }) => {
  const styles = useStyles2(getStyles);

  const [filters, setFilters] = useState<Array<{ column: string; operator: string; value: string }>>([]);

  const debouncedFilters = useDebounce(filters, 300);

  const updateQueryWithFilters = useCallback(
    (updatedFilters: Array<{ column: string; operator: string; value: string }>) => {
      const hasValue = updatedFilters.some((f) => f.value.trim() !== '');
      if (!hasValue && updatedFilters.length !== 0) {
        return;
      }

      let baseQuery = query.azureLogAnalytics?.query || '';

      if (updatedFilters.length === 0) {
        baseQuery = baseQuery.replace(/\| where .*/, '').trim();
      } else {
        const filterClause = updatedFilters.map((f) => `${f.column} ${f.operator} '${f.value}'`).join(' and ');

        baseQuery = baseQuery.includes('| where')
          ? baseQuery.replace(/\| where .*/, `| where ${filterClause}`)
          : `${baseQuery} | where ${filterClause}`;
      }

      const formattedQuery = formatKQLQuery(baseQuery);

      if (query.azureLogAnalytics?.query !== formattedQuery) {
        onChange({
          ...query,
          azureLogAnalytics: {
            ...query.azureLogAnalytics,
            query: formattedQuery,
          },
        });
      }
    },
    [query, onChange]
  );

  useEffect(() => {
    if (debouncedFilters.length === filters.length) {
      updateQueryWithFilters(filters);
    }
  }, [filters, debouncedFilters, updateQueryWithFilters]);

  const onChangeFilter = (index: number, key: keyof (typeof filters)[0], value: string) => {
    setFilters((prevFilters) => prevFilters.map((f, i) => (i === index ? { ...f, [key]: value || '' } : f)));
  };

  const onDeleteFilter = (index: number) => {
    setFilters((prevFilters) => {
      const updatedFilters = prevFilters.filter((_, i) => i !== index);
      console.log('Deleted filter at index:', index, 'New filters:', updatedFilters);

      if (updatedFilters.length === 0) {
        updateQueryWithFilters([]);
      }

      return updatedFilters;
    });
  };

  return (
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
                      onChange={(e) => onChangeFilter(index, 'value', e.currentTarget.value)}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData('Text').trim();
                        onChangeFilter(index, 'value', pastedText);
                      }}
                      width={30}
                    />
                    <Button variant="secondary" icon="times" onClick={() => onDeleteFilter(index)} />
                    {index < filters.length - 1 ? <Label>AND</Label> : <></>}
                  </InputGroup>
                ))}
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => setFilters([...filters, { column: '', operator: '==', value: '' }])}
              icon="plus"
            ></Button>
          </>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};

const getStyles = () => ({
  filters: css({ marginBottom: '8px' }),
});
