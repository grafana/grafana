import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Input, Label, Select, useStyles2 } from '@grafana/ui';

import { toOperatorOptions, valueToDefinition } from './utils';

interface FilterSectionProps {
  selectedColumns: Array<SelectableValue<string>>;
  onQueryUpdate: (params: { filters?: string }) => void;
}

export const FilterSection: React.FC<FilterSectionProps> = ({ onQueryUpdate, selectedColumns }) => {
  const styles = useStyles2(getStyles);
  const [filters, setFilters] = useState<Array<{ column: string; operator: string; value: string }>>([]);

  useEffect(() => {
    if (selectedColumns.length === 0) {
      setFilters([]); 
    }
  }, [selectedColumns]);

  const formatFilters = (filters: Array<{ column: string; operator: string; value: string }>): string => {
    return filters
      .filter((f) => f.column && f.operator && f.value.trim() !== '')
      .map((f) => `${f.column} ${f.operator} '${f.value}'`)
      .join(' and ');
  };

  const updateFilters = (newFilters: Array<{ column: string; operator: string; value: string }>) => {
    setFilters(newFilters);
    const formattedFilters = formatFilters(newFilters);
    if (formattedFilters) {
      onQueryUpdate({ filters: formattedFilters });
    }
  };

  const onChangeFilter = (index: number, key: keyof (typeof filters)[0], value: string) => {
    const newFilters = filters.map((f, i) => (i === index ? { ...f, [key]: value || '' } : f));
    updateFilters(newFilters);
  };

  const onDeleteFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    updateFilters(newFilters);
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
                      options={selectedColumns}
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
              onClick={() => updateFilters([...filters, { column: '', operator: '==', value: '' }])}
              icon="plus"
            />
          </>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};

const getStyles = () => ({
  filters: css({ marginBottom: '8px' }),
});
