import { css } from '@emotion/css';
import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Input, Label, Select, useStyles2 } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorOperatorExpression,
  BuilderQueryEditorPropertyType,
  BuilderQueryExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';
import { getAggregations, toOperatorOptions, valueToDefinition } from './utils';

interface FilterSectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
  templateVariableOptions: SelectableValue<string>;
}

export const FilterSection: React.FC<FilterSectionProps> = ({
  onQueryUpdate,
  query,
  allColumns,
  templateVariableOptions,
}) => {
  const styles = useStyles2(getStyles);
  const [filters, setFilters] = useState<Array<{ column: string; operator: string; value: string }>>([]);
  const builderQuery = query.azureLogAnalytics?.builderQuery;

  if (!builderQuery) {
    return;
  }

  const safeTemplateVariables: Array<SelectableValue<string>> =
    templateVariableOptions && templateVariableOptions.value
      ? Array.isArray(templateVariableOptions)
        ? templateVariableOptions
        : [templateVariableOptions]
      : [];

  const availableColumns: Array<SelectableValue<string>> = builderQuery.columns?.columns?.length
    ? builderQuery.columns.columns.map((col) => ({ label: col, value: col }))
    : allColumns.map((col) => ({ label: col.name, value: col.name }));

  const selectableOptions = availableColumns.concat(safeTemplateVariables);

  const formatFilters = (filters: Array<{ column: string; operator: string; value: string }>): string => {
    return filters
      .filter((f) => f.column && f.operator && f.value.trim() !== '')
      .map((f) => {
        let value = f.value.trim();

        if (!(value.startsWith("'") && value.endsWith("'"))) {
          value = `'${value.replace(/'/g, "\\'")}'`;
        }

        return `${f.column} ${f.operator} ${value}`;
      })
      .join(' and ');
  };

  const onChangeFilter = (index: number, key: keyof (typeof filters)[0], value: string) => {
    let updatedFilters = [...filters];

    if (index === -1) {
      updatedFilters.push({ column: '', operator: '==', value: '' });
      index = updatedFilters.length - 1;
    } else {
      updatedFilters[index] = { ...updatedFilters[index], [key]: value || '' };
    }

    setFilters(updatedFilters);

    if (builderQuery?.where?.expressions) {
      let updatedWhereExpressions: BuilderQueryEditorOperatorExpression[] = [];

      if (updatedFilters.length > 0) {
        updatedWhereExpressions = updatedFilters.map((filter) => ({
          type: BuilderQueryEditorExpressionType.Operator,
          operator: { name: filter.operator, value: filter.value },
          property: { name: filter.column, type: BuilderQueryEditorPropertyType.String },
        }));
      }

      const updatedBuilderQuery: BuilderQueryExpression = {
        ...builderQuery,
        where: updatedWhereExpressions.length
          ? { ...builderQuery.where, expressions: updatedWhereExpressions }
          : undefined,
      };

      const formattedFilters = updatedFilters.length ? formatFilters(updatedFilters) : '';

      const aggregation = getAggregations(builderQuery.reduce?.expressions);
      const updatedQueryString = AzureMonitorKustoQueryParser.toQuery(
        updatedBuilderQuery,
        allColumns,
        aggregation,
        formattedFilters
      );

      onQueryUpdate({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          builderQuery: updatedBuilderQuery,
          query: updatedQueryString,
        },
      });
    }
  };

  const onDeleteFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);

    if (builderQuery?.where?.expressions) {
      let updatedWhereExpressions: BuilderQueryEditorOperatorExpression[] = [];

      if (newFilters.length > 0) {
        updatedWhereExpressions = newFilters.map((filter) => ({
          type: BuilderQueryEditorExpressionType.Operator,
          operator: { name: filter.operator, value: filter.value },
          property: { name: filter.column, type: BuilderQueryEditorPropertyType.String },
        }));
      }

      const updatedBuilderQuery: BuilderQueryExpression = {
        ...builderQuery,
        where: updatedWhereExpressions.length
          ? { ...builderQuery.where, expressions: updatedWhereExpressions }
          : undefined,
      };

      const formattedFilters = newFilters.length ? formatFilters(newFilters) : '';

      const aggregation = getAggregations(builderQuery.reduce?.expressions);
      const updatedQueryString = AzureMonitorKustoQueryParser.toQuery(
        updatedBuilderQuery,
        allColumns,
        aggregation,
        formattedFilters
      );

      onQueryUpdate({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          builderQuery: updatedBuilderQuery,
          query: updatedQueryString,
        },
      });
    }
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
                      options={selectableOptions}
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
            <Button variant="secondary" onClick={() => onChangeFilter(-1, 'column', '')} icon="plus" />
          </>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};

const getStyles = () => ({
  filters: css({ marginBottom: '8px' }),
});
