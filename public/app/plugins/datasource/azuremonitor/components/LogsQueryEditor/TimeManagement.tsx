import { useCallback, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, RadioButtonGroup, Select } from '@grafana/ui';

import { AzureQueryEditorFieldProps } from '../../types';

import { setDashboardTime, setTimeColumn } from './setQueryValue';

export function TimeManagement({ query, onQueryChange: onChange, schema }: AzureQueryEditorFieldProps) {
  const [defaultTimeColumns, setDefaultTimeColumns] = useState<SelectableValue[] | undefined>();
  const [timeColumns, setTimeColumns] = useState<SelectableValue[] | undefined>();
  const [disabledTimePicker, setDisabledTimePicker] = useState<boolean>(false);

  const setDefaultColumn = useCallback((column: string) => onChange(setTimeColumn(query, column)), [query, onChange]);

  useEffect(() => {
    if (schema && query.azureLogAnalytics?.dashboardTime) {
      const timeColumnOptions: SelectableValue[] = [];
      const timeColumnsSet: Set<string> = new Set();
      const defaultColumnsMap: Map<string, SelectableValue> = new Map();
      const db = schema.database;
      if (db) {
        for (const table of db.tables) {
          const cols = table.columns.reduce<SelectableValue[]>((prev, curr, i) => {
            if (curr.type === 'datetime') {
              if (!table.timespanColumn || table.timespanColumn !== curr.name) {
                prev.push({ value: curr.name, label: `${table.name} > ${curr.name}` });
                timeColumnsSet.add(curr.name);
              }
            }
            return prev;
          }, []);
          timeColumnOptions.push(...cols);
          if (table.timespanColumn && !defaultColumnsMap.has(table.timespanColumn)) {
            defaultColumnsMap.set(table.timespanColumn, {
              value: table.timespanColumn,
              label: table.timespanColumn,
            });
          }
        }
      }
      setTimeColumns(timeColumnOptions);
      const defaultColumns = Array.from(defaultColumnsMap.values());
      setDefaultTimeColumns(defaultColumns);

      // Set default value
      if (
        !query.azureLogAnalytics.timeColumn ||
        (query.azureLogAnalytics.timeColumn &&
          !timeColumnsSet.has(query.azureLogAnalytics.timeColumn) &&
          !defaultColumnsMap.has(query.azureLogAnalytics.timeColumn))
      ) {
        if (defaultColumns && defaultColumns.length) {
          setDefaultColumn(defaultColumns[0].value);
          setDefaultColumn(defaultColumns[0].value);
          return;
        } else if (timeColumnOptions && timeColumnOptions.length) {
          setDefaultColumn(timeColumnOptions[0].value);
          return;
        } else {
          setDefaultColumn('TimeGenerated');
          return;
        }
      }
    }
  }, [schema, query.azureLogAnalytics?.dashboardTime, query.azureLogAnalytics?.timeColumn, setDefaultColumn]);

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

  useEffect(() => {
    if (query.azureLogAnalytics?.basicLogsQuery) {
      setDisabledTimePicker(true);
    } else {
      setDisabledTimePicker(false);
    }
  }, [query.azureLogAnalytics?.basicLogsQuery]);

  return (
    <>
      <InlineField
        label="Time-range"
        tooltip={
          <span>
            Specifies the time-range used to query. The <code>Query</code> option will only use time-ranges specified in
            the query. <code>Dashboard</code> will only use the Grafana time-range. In Logs Builder mode, only Dashboard
            time will be used.
          </span>
        }
      >
        <RadioButtonGroup
          options={[
            { label: 'Query', value: 'query', disabled: query.azureLogAnalytics?.mode === 'builder' },
            { label: 'Dashboard', value: 'dashboard' },
          ]}
          value={
            query.azureLogAnalytics?.dashboardTime || query.azureLogAnalytics?.mode === 'builder'
              ? 'dashboard'
              : 'query'
          }
          size={'md'}
          onChange={(val) => onChange(setDashboardTime(query, val))}
          disabled={disabledTimePicker}
          disabledOptions={disabledTimePicker ? ['query'] : []}
        />
      </InlineField>
      {(query.azureLogAnalytics?.dashboardTime || query.azureLogAnalytics?.mode === 'builder') && (
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
