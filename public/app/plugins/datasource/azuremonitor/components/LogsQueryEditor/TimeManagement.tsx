import React, { useCallback, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, RadioButtonGroup, Select } from '@grafana/ui';

import { AzureQueryEditorFieldProps } from '../../types';

import { setDashboardTime, setTimeColumn } from './setQueryValue';

export function TimeManagement({ query, onQueryChange: onChange, schema }: AzureQueryEditorFieldProps) {
  const [defaultTimeColumns, setDefaultTimeColumns] = useState<SelectableValue[] | undefined>();
  const [timeColumns, setTimeColumns] = useState<SelectableValue[] | undefined>();

  useEffect(() => {
    if (schema && query.azureLogAnalytics?.dashboardTime) {
      let timeColumns: SelectableValue[] = [];
      let defaultColumnsMap: Map<string, SelectableValue> = new Map();
      const db = schema.database;
      if (db) {
        for (const table of db.tables) {
          const cols = table.columns.reduce<SelectableValue[]>((prev, curr, i) => {
            if (curr.type === 'datetime') {
              if (!table.timespanColumn) {
                prev.push({ value: curr.name, label: `${table.name} > ${curr.name}` });
              } else {
                if (table.timespanColumn !== curr.name) {
                  prev.push({ value: curr.name, label: `${table.name} > ${curr.name}` });
                }
              }
            }
            return prev;
          }, []);
          timeColumns = timeColumns.concat(cols);
          if (table.timespanColumn && !defaultColumnsMap.has(table.timespanColumn)) {
            defaultColumnsMap.set(table.timespanColumn, {
              value: table.timespanColumn,
              label: table.timespanColumn,
            });
          }
        }
      }
      setTimeColumns(timeColumns);
      const defaultColumns = Array.from(defaultColumnsMap.values());
      setDefaultTimeColumns(defaultColumns);

      // Set default value
      if (!query.azureLogAnalytics.timeColumn) {
        if (defaultColumns && defaultColumns.length) {
          onChange(setTimeColumn(query, defaultColumns[0].value));
          return;
        } else if (timeColumns && timeColumns.length) {
          onChange(setTimeColumn(query, timeColumns[0].value));
          return;
        } else {
          onChange(setTimeColumn(query, 'TimeGenerated'));
          return;
        }
      }
    }
  }, [schema, query.azureLogAnalytics?.dashboardTime, onChange, query]);

  const handleTimeColumnChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      const newQuery = setTimeColumn(query, change.value);
      onChange(newQuery);
    },
    [onChange, query]
  );
  return (
    <>
      <InlineField
        label="Time-range"
        tooltip={
          <span>
            Specifies the time-range used to query. The <code>Query</code> option will only use time-ranges specified in
            the query. <code>Dashboard</code> will only use the Grafana time-range.
          </span>
        }
      >
        <RadioButtonGroup
          options={[
            { label: 'Query', value: false },
            { label: 'Dashboard', value: true },
          ]}
          value={query.azureLogAnalytics?.dashboardTime ?? false}
          size={'md'}
          onChange={(val) => onChange(setDashboardTime(query, val))}
        />
      </InlineField>
      {query.azureLogAnalytics?.dashboardTime && (
        <InlineField
          label="Time Column"
          tooltip={
            <span>
              Specifies the time column used for filtering. Defaults to the first tables <code>timeSpan</code> column,
              the first <code>datetime</code> column found or <code>TimeGenerated</code>.
            </span>
          }
        >
          <Select
            options={[
              {
                label: 'Default time columns',
                options: defaultTimeColumns ?? [{ value: 'TimeGenerated', label: 'TimeGenerated' }],
              },
              {
                label: 'Other time columns',
                options: timeColumns ?? [],
              },
            ]}
            onChange={handleTimeColumnChange}
            value={
              query.azureLogAnalytics?.timeColumn
                ? query.azureLogAnalytics?.timeColumn
                : defaultTimeColumns
                ? defaultTimeColumns[0]
                : timeColumns
                ? timeColumns[0]
                : { value: 'TimeGenerated', label: 'TimeGenerated' }
            }
            allowCustomValue
          />
        </InlineField>
      )}
    </>
  );
}
