import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { CoreApp, getDefaultTimeRange, SelectableValue, TimeRange } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, ComboboxOption, Label, useStyles2 } from '@grafana/ui';

import {
  AzureQueryType,
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorWhereExpression,
  BuilderQueryEditorWhereExpressionItems,
} from '../../dataquery.gen';
import Datasource from '../../datasource';
import { AzureLogAnalyticsMetadataColumn } from '../../types/logAnalyticsMetadata';
import { AzureMonitorQuery } from '../../types/query';
import { AzureMonitorOption } from '../../types/types';

import { FilterItem } from './FilterItem';
import { BuildAndUpdateOptions } from './utils';

interface FilterSectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  buildAndUpdateQuery: (options: Partial<BuildAndUpdateOptions>) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
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
  variableOptionGroup,
  datasource,
  timeRange,
}) => {
  const styles = useStyles2(() => ({ filters: css({ marginBottom: '8px' }) }));
  const builderQuery = query.azureLogAnalytics?.builderQuery;

  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);
  const [filters, setFilters] = useState<BuilderQueryEditorWhereExpression[]>(
    builderQuery?.where?.expressions?.map((group) => ({
      ...group,
      expressions: group.expressions ?? [],
    })) || []
  );
  const hasLoadedFilters = useRef(false);

  const availableColumns: Array<SelectableValue<string>> = builderQuery?.columns?.columns?.length
    ? filterDynamicColumns(builderQuery.columns.columns, allColumns).map((col) => ({ label: col, value: col }))
    : allColumns.filter((col) => col.type !== 'dynamic').map((col) => ({ label: col.name, value: col.name }));

  const usedColumnsInOtherGroups = (currentGroupIndex: number): string[] => {
    return filters
      .flatMap((group, idx) => (idx !== currentGroupIndex ? group.expressions : []))
      .map((exp) => exp.property.name)
      .filter(Boolean);
  };

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;
    if (prevTable.current !== currentTable || builderQuery?.where?.expressions.length === 0) {
      setFilters([]);
      hasLoadedFilters.current = false;
      prevTable.current = currentTable;
    }
  }, [builderQuery]);

  const updateFilters = (updated: BuilderQueryEditorWhereExpression[]) => {
    setFilters(updated);
    buildAndUpdateQuery({ where: updated });
  };

  const onAddOrFilters = (
    groupIndex: number,
    field: 'property' | 'operator' | 'value',
    value: string,
    filterIndex?: number
  ) => {
    const updated = [...filters];
    const group = updated[groupIndex];
    if (!group) {
      return;
    }

    let filter: BuilderQueryEditorWhereExpressionItems =
      filterIndex !== undefined
        ? { ...group.expressions[filterIndex] }
        : {
            type: BuilderQueryEditorExpressionType.Operator,
            property: { name: '', type: BuilderQueryEditorPropertyType.String },
            operator: { name: '==', value: '' },
          };

    if (field === 'property') {
      filter.property.name = value;
      filter.operator.value = '';
    } else if (field === 'operator') {
      filter.operator.name = value;
    } else if (field === 'value') {
      filter.operator.value = value;
    }

    const isValid = filter.property.name && filter.operator.name && filter.operator.value !== '';

    if (filterIndex !== undefined) {
      group.expressions[filterIndex] = filter;
    } else {
      group.expressions.push(filter);
    }

    updated[groupIndex] = group;
    setFilters(updated);
    if (isValid) {
      updateFilters(updated);
    }
  };

  const onAddAndFilters = () => {
    const updated = [
      ...filters,
      {
        type: BuilderQueryEditorExpressionType.Or,
        expressions: [
          {
            type: BuilderQueryEditorExpressionType.Operator,
            property: { name: '', type: BuilderQueryEditorPropertyType.String },
            operator: { name: '==', value: '' },
          },
        ],
      },
    ];
    updateFilters(updated);
  };

  const onDeleteFilter = (groupIndex: number, filterIndex: number) => {
    const updated = [...filters];
    updated[groupIndex].expressions.splice(filterIndex, 1);
    if (updated[groupIndex].expressions.length === 0) {
      updated.splice(groupIndex, 1);
    }
    updateFilters(updated);
  };

  const getFilterValues = async (filter: BuilderQueryEditorWhereExpressionItems) => {
    const from = timeRange?.from?.toISOString();
    const to = timeRange?.to?.toISOString();
    const timeColumn = query.azureLogAnalytics?.timeColumn || 'TimeGenerated';

    const kustoQuery = `
      ${query.azureLogAnalytics?.builderQuery?.from?.property.name}
      | where ${timeColumn} >= datetime(${from}) and ${timeColumn} <= datetime(${to})
      | distinct ${filter.property.name}
      | limit 1000
    `;

    const results = await lastValueFrom(
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

      const dynamicValues = values.toArray().map(
        (v: unknown): ComboboxOption<string> => ({
          label: String(v),
          value: String(v),
        })
      );

      return [...variableOptionGroup.options, ...dynamicValues];
    }

    return variableOptionGroup.options;
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField
          label={t('components.filter-section.label-filters', 'Filters')}
          optional
          tooltip={t(
            'components.filter-section.tooltip-filters',
            'Narrow results by applying conditions to specific columns.'
          )}
        >
          <div className={styles.filters}>
            {filters.length === 0 || filters.every((g) => g.expressions.length === 0) ? (
              <InputGroup>
                <Button
                  aria-label={t('components.filter-section.aria-label-add-filter', 'Add filter')}
                  variant="secondary"
                  onClick={onAddAndFilters}
                  icon="plus"
                />
              </InputGroup>
            ) : (
              <>
                {filters.map((group, groupIndex) => (
                  <div key={groupIndex}>
                    {groupIndex > 0 && filters[groupIndex - 1]?.expressions.length > 0 && (
                      <Label style={{ padding: '9px 14px' }}>
                        <Trans i18nKey="components.filter-section.label-and">AND</Trans>
                      </Label>
                    )}
                    <InputGroup>
                      <>
                        {group.expressions.map((filter, filterIndex) => (
                          <FilterItem
                            key={`${groupIndex}-${filterIndex}`}
                            filter={filter}
                            filterIndex={filterIndex}
                            groupIndex={groupIndex}
                            usedColumns={usedColumnsInOtherGroups(groupIndex)}
                            availableColumns={availableColumns}
                            onChange={onAddOrFilters}
                            onDelete={onDeleteFilter}
                            getFilterValues={getFilterValues}
                            showOr={filterIndex < group.expressions.length - 1}
                          />
                        ))}
                      </>
                      <Button
                        tooltip={t('components.filter-section.aria-label-add-or-filter', 'Add OR filter')}
                        variant="secondary"
                        style={{ marginLeft: '15px' }}
                        onClick={() => onAddOrFilters(groupIndex, 'property', '')}
                        icon="plus"
                      />
                    </InputGroup>
                  </div>
                ))}
                {filters.some((g) => g.expressions.length > 0) && (
                  <Button variant="secondary" onClick={onAddAndFilters} style={{ marginTop: '8px' }}>
                    <Trans i18nKey="components.filter-section.label-add-group">Add group</Trans>
                  </Button>
                )}
              </>
            )}
          </div>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
