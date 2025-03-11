import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Input, Label, Select, useStyles2 } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';
import { toOperatorOptions, valueToDefinition } from './utils';

interface FilterSectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
}

export const FilterSection: React.FC<FilterSectionProps> = ({ onQueryUpdate, query, allColumns }) => {
  const styles = useStyles2(getStyles);
  const [filters, setFilters] = useState<Array<{ column: string; operator: string; value: string }>>([]);
  const builderQuery = query.azureLogAnalytics?.builderQuery;

  if (!builderQuery) {
    return;
  }

  const selectableColumns: Array<SelectableValue<string>> = useMemo(
    () => allColumns.map((col) => ({ label: col.name, value: col.name })),
    [allColumns]
  );

  const allColumnsSelectable: Array<SelectableValue<string>> = useMemo(
    () => (builderQuery?.columns?.columns || []).map((col) => ({ label: col, value: col })),
    [builderQuery?.columns?.columns]
  );

  useEffect(() => {
    setFilters([]);
  }, [builderQuery.from?.property.name]);

  const getAggregationString = (reduceExpressions: any[] = [], allColumns: AzureLogAnalyticsMetadataColumn[]) => {
    return reduceExpressions
      .map((agg) => {
        if (agg.reduce?.name === 'count') {
          // If it's a 'count' aggregation, check if a property exists
          return agg.property?.name ? `count(${agg.property.name})` : 'count()';
        }

        // For other types of aggregation, return the standard format
        return `${agg.reduce.name}(${agg.property?.name})`;
      })
      .join(', ');
  };

  const formatFilters = (filters: Array<{ column: string; operator: string; value: string }>): string => {
    return filters
      .filter((f) => f.column && f.operator && f.value.trim() !== '')
      .map((f) => `${f.column} ${f.operator} '${f.value}'`)
      .join(' and ');
  };

  const updateFilters = (newFilters: Array<{ column: string; operator: string; value: string }>) => {
    setFilters(newFilters);

    if (builderQuery) {
      const updatedBuilderQuery: BuilderQueryExpression = {
        ...builderQuery,
        from: {
          property: { name: builderQuery.from?.property.name!, type: BuilderQueryEditorPropertyType.String },
          type: BuilderQueryEditorExpressionType.Property,
        },
      };

      const updatedFilters = newFilters
        .map((filter) => `${filter.column} ${filter.operator} '${filter.value}'`)
        .join(' and ');

      const aggregation = getAggregationString(builderQuery.reduce?.expressions, allColumns);
      const updatedQueryString = AzureMonitorKustoQueryParser.toQuery(
        updatedBuilderQuery,
        allColumns,
        aggregation,
        updatedFilters
      );

      const formattedFilters = formatFilters(newFilters);
      if (formattedFilters) {
        onQueryUpdate({
          ...query,
          azureLogAnalytics: {
            ...query.azureLogAnalytics,
            builderQuery: updatedBuilderQuery,
            query: updatedQueryString,
          },
        });
      }
    }
  };

  const onChangeFilter = (index: number, key: keyof (typeof filters)[0], value: string) => {
    const newFilters = filters.map((f, i) => (i === index ? { ...f, [key]: value || '' } : f));
    updateFilters(newFilters);
  };

  const onDeleteFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);

    const updatedFilters =
      newFilters.length > 0 ? newFilters.map((f) => `${f.column} ${f.operator} '${f.value}'`).join(' and ') : '';

    if (builderQuery) {
      const updatedBuilderQuery: BuilderQueryExpression = {
        ...builderQuery,
        from: {
          property: { name: builderQuery.from?.property.name!, type: BuilderQueryEditorPropertyType.String },
          type: BuilderQueryEditorExpressionType.Property,
        },
      };

      const aggregation = getAggregationString(builderQuery.reduce?.expressions, allColumns);
      const updatedQueryString = AzureMonitorKustoQueryParser.toQuery(
        updatedBuilderQuery,
        allColumns,
        aggregation,
        updatedFilters
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
                      options={allColumnsSelectable.length > 0 ? allColumnsSelectable : selectableColumns}
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
