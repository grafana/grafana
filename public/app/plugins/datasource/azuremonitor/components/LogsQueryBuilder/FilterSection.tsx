import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Input, Label, Select, useStyles2 } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorWhereExpression,
  BuilderQueryExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';
import {
  getAggregations,
  isOperatorExpression,
  removeExtraQuotes,
  toOperatorOptions,
  valueToDefinition,
} from './utils';

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
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);

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

  const [filters, setFilters] = useState<Array<{ column: string; operator: string; value: string }>>(() => {
    return (
      builderQuery?.where?.expressions
        ?.filter(isOperatorExpression)
        ?.filter((exp) => !exp.property?.name?.startsWith('$__timeFilter'))
        .filter((exp) => !exp.operator?.name?.startsWith('has'))
        ?.map((exp) => ({
          column: exp.property?.name || '',
          operator: exp.operator?.name || '==',
          value: removeExtraQuotes(String(exp.operator?.value) ?? ''),
        })) || []
    );
  });

  const hasLoadedFilters = useRef(false);

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable) {
      setFilters([]);
      hasLoadedFilters.current = false;
      prevTable.current = currentTable;
    }

    if (!hasLoadedFilters.current && builderQuery?.where?.expressions && selectableOptions.length > 0) {
      const filteredExpressions = builderQuery.where.expressions
        .filter(isOperatorExpression)
        .filter((exp) => {
          const columnName = exp.property?.name?.trim();
          const isTimeFilter = columnName?.startsWith('$__timeFilter');
          const isFuzzySearch = exp.operator?.name === 'has';
          const isValidColumn = selectableOptions.some((col) => col.value === columnName);

          if (isTimeFilter || isFuzzySearch) {
            return false;
          }

          return isValidColumn;
        })
        .map((exp) => ({
          column: exp.property?.name || '',
          operator: exp.operator?.name || '==',
          value: removeExtraQuotes(String(exp.operator?.value) ?? ''),
        }));

      setFilters(filteredExpressions);
      hasLoadedFilters.current = true;
    }
  }, [builderQuery, selectableOptions]);

  const formatFilters = (filters: Array<{ column: string; operator: string; value: string }>): string => {
    return filters
      .filter((f) => f.column && f.operator && f.value.trim() !== '')
      .map((f) => {
        let value = removeExtraQuotes(f.value.trim());

        return `${f.column} ${f.operator} '${value}'`;
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
      let updatedWhereExpressions: BuilderQueryEditorWhereExpression[] = [];

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
      let updatedWhereExpressions: BuilderQueryEditorWhereExpression[] = [];

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
