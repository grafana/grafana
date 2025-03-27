import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { CoreApp, getDefaultTimeRange, SelectableValue, TimeRange } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Combobox, Select, useStyles2 } from '@grafana/ui';

import {
  AzureQueryType,
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorWhereExpression,
} from '../../dataquery.gen';
import Datasource from '../../datasource';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { BuildAndUpdateOptions, inputFieldSize, toOperatorOptions, valueToDefinition } from './utils';

interface FilterSectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  buildAndUpdateQuery: (options: Partial<BuildAndUpdateOptions>) => void;
  templateVariableOptions: SelectableValue<string>;
  datasource: Datasource;
  timeRange?: TimeRange;
}

const filterDynamicColumns = (columns: string[], allColumns: AzureLogAnalyticsMetadataColumn[]) => {
  return columns.filter((col) =>
    allColumns.some((completeCol) => completeCol.name === col && completeCol.type !== 'dynamic')
  );
};

export const FilterSection: React.FC<FilterSectionProps> = ({
  buildAndUpdateQuery,
  query,
  allColumns,
  templateVariableOptions,
  datasource,
  timeRange,
}) => {
  const styles = useStyles2(getStyles);
  const builderQuery = query.azureLogAnalytics?.builderQuery;

  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);
  const [filters, setFilters] = useState<BuilderQueryEditorWhereExpression[]>(builderQuery?.where?.expressions || []);
  const hasLoadedFilters = useRef(false);

  const variableOptions = Array.isArray(templateVariableOptions) ? templateVariableOptions : [templateVariableOptions];

  const availableColumns: Array<SelectableValue<string>> = builderQuery?.columns?.columns?.length
    ? filterDynamicColumns(builderQuery.columns.columns, allColumns).map((col) => ({ label: col, value: col }))
    : allColumns.filter((col) => col.type !== 'dynamic').map((col) => ({ label: col.name, value: col.name }));

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

  const onChangeFilter = async (index: number, field: 'property' | 'operator' | 'value', value: string) => {
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
      filter.operator.value = '';
    } else if (field === 'operator') {
      filter.operator.name = value;
    } else if (field === 'value') {
      filter.operator.value = value;
    }

    updated[index] = filter;

    const isValid =
      filter.property?.name?.trim() &&
      filter.operator?.name?.trim() &&
      filter.operator?.value !== undefined &&
      filter.operator?.value !== '';

    setFilters(updated);
    if (isValid) {
      updateFilters(updated);
    }
  };

  const onDeleteFilter = (index: number) => {
    const updated = filters.filter((_, i) => i !== index);
    updateFilters(updated);
  };

  const getFilterValues = async (filter: BuilderQueryEditorWhereExpression) => {
    const from = timeRange?.from?.toISOString();
    const to = timeRange?.to?.toISOString();
    const timeColumn = query.azureLogAnalytics?.timeColumn || 'TimeGenerated';

    const kustoQuery = `
    ${query.azureLogAnalytics?.builderQuery?.from?.property.name}
    | where ${timeColumn} >= datetime(${from}) and ${timeColumn} <= datetime(${to})
    | distinct ${filter.property.name}
    | limit 1000
  `;

    const results: any = await lastValueFrom(
      datasource.azureLogAnalyticsDatasource.query({
        requestId: 'azure-logs-builder-filter-values',
        interval: '',
        intervalMs: 0,
        scopedVars: {},
        timezone: '',
        app: CoreApp.Unknown,
        startTime: 0,
        range: timeRange || getDefaultTimeRange(),
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.LogAnalytics,
            azureLogAnalytics: {
              query: kustoQuery,
              resources: query.azureLogAnalytics?.resources ?? [],
            },
          },
        ],
      })
    );
    if (results.state === 'Done') {
      const values = results.data?.[0]?.fields?.[0]?.values ?? [];

      const selectable = values.toArray().map((v: any) => ({
        label: String(v),
        value: String(v),
      }));

      return selectable;
    }
    return [];
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField
          label="Filters"
          optional={true}
          tooltip={
            'Narrow results by applying conditions to specific columns. Columns with the dynamic type are not available for filtering.'
          }
        >
          <div className={styles.filters}>
            {filters.length > 0 ? (
              filters.map((filter, index) => (
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
                  <Combobox
                    aria-label="column value"
                    value={
                      filter.operator.value
                        ? { label: String(filter.operator.value), value: String(filter.operator.value) }
                        : null
                    }
                    options={() => getFilterValues(filter)}
                    onChange={(e) => e.value && onChangeFilter(index, 'value', e.value)}
                    width={inputFieldSize}
                    disabled={!filter.property?.name}
                  />

                  <Button variant="secondary" icon="times" onClick={() => onDeleteFilter(index)} />
                  {index === filters.length - 1 ? (
                    <Button
                      variant="secondary"
                      style={{ marginLeft: '15px' }}
                      onClick={() => onChangeFilter(-1, 'property', '')}
                      icon="plus"
                    />
                  ) : (
                    <></>
                  )}
                </InputGroup>
              ))
            ) : (
              <InputGroup>
                <Button variant="secondary" onClick={() => onChangeFilter(-1, 'property', '')} icon="plus" />
              </InputGroup>
            )}
          </div>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};

const getStyles = () => ({
  filters: css({ marginBottom: '8px' }),
});
