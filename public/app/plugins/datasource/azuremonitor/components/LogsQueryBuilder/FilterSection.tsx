import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Input, Label, Select, useStyles2 } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorWhereExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { BuildAndUpdateOptions, inputFieldSize, toOperatorOptions, valueToDefinition } from './utils';

interface FilterSectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  buildAndUpdateQuery: (options: Partial<BuildAndUpdateOptions>) => void;
  templateVariableOptions: SelectableValue<string>;
}

export const FilterSection: React.FC<FilterSectionProps> = ({
  buildAndUpdateQuery,
  query,
  allColumns,
  templateVariableOptions,
}) => {
  const styles = useStyles2(getStyles);
  const builderQuery = query.azureLogAnalytics?.builderQuery;

  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);
  const [filters, setFilters] = useState<BuilderQueryEditorWhereExpression[]>(builderQuery?.where?.expressions || []);
  const hasLoadedFilters = useRef(false);

  const variableOptions = Array.isArray(templateVariableOptions) ? templateVariableOptions : [templateVariableOptions];

  const availableColumns: Array<SelectableValue<string>> = builderQuery?.columns?.columns?.length
    ? builderQuery.columns.columns.map((col) => ({ label: col, value: col }))
    : allColumns.map((col) => ({ label: col.name, value: col.name }));

  const selectableOptions = [...availableColumns, ...variableOptions];

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable) {
      setFilters([]);
      hasLoadedFilters.current = false;
      prevTable.current = currentTable;
    }

    if (!hasLoadedFilters.current && builderQuery?.where?.expressions) {
      setFilters(builderQuery.where.expressions);
      hasLoadedFilters.current = true;
    }
  }, [builderQuery]);

  const updateFilters = (updated: BuilderQueryEditorWhereExpression[]) => {
    setFilters(updated);

    buildAndUpdateQuery({
      where: updated,
    });
  };

  const onChangeFilter = (index: number, field: 'property' | 'operator' | 'value', value: string) => {
    const updated = [...filters];

    if (index === -1) {
      updated.push({
        type: BuilderQueryEditorExpressionType.Operator,
        property: { name: '', type: BuilderQueryEditorPropertyType.String },
        operator: { name: '==', value: '' },
      });
      index = updated.length - 1;
    }

    const filter = updated[index];

    if (field === 'property') {
      filter.property.name = value;
    } else if (field === 'operator') {
      filter.operator.name = value;
    } else if (field === 'value') {
      filter.operator.value = value;
    }

    updated[index] = filter;
    updateFilters(updated);
  };

  const onDeleteFilter = (index: number) => {
    const updated = filters.filter((_, i) => i !== index);
    updateFilters(updated);
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField
          label="Filters"
          optional={true}
          tooltip={`Narrow results by applying conditions to specific columns. Filters help focus on relevant data by using
              operators such as equals, not equals, greater than, less than, or contains to define criteria that rows
              must match to be included in the results.`}
        >
          <>
            {filters.length > 0 && (
              <div className={styles.filters}>
                {filters.map((filter, index) => (
                  <InputGroup key={index}>
                    <Select
                      aria-label="column"
                      width={inputFieldSize}
                      value={valueToDefinition(filter.property.name)}
                      options={selectableOptions}
                      onChange={(e) => e.value && onChangeFilter(index, 'property', e.value)}
                    />
                    <Select
                      aria-label="operator"
                      width={12}
                      value={{ label: filter.operator.name, value: filter.operator.name }}
                      options={toOperatorOptions('string')}
                      onChange={(e) => e.value && onChangeFilter(index, 'operator', e.value)}
                    />
                    <Input
                      aria-label="column value"
                      value={String(filter.operator.value ?? '')}
                      onChange={(e) => onChangeFilter(index, 'value', e.currentTarget.value)}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('Text').trim();
                        onChangeFilter(index, 'value', pasted);
                      }}
                      width={inputFieldSize}
                    />
                    <Button variant="secondary" icon="times" onClick={() => onDeleteFilter(index)} />
                    {index < filters.length - 1 ? <Label>AND</Label> : <></>}
                    <Button
                      variant="secondary"
                      style={{ marginLeft: '15px' }}
                      onClick={() => onChangeFilter(-1, 'property', '')}
                      icon="plus"
                    />
                  </InputGroup>
                ))}
              </div>
            )}
          </>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};

const getStyles = () => ({
  filters: css({ marginBottom: '8px' }),
});
