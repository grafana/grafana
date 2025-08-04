import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import { useCallback } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { EditorField } from '@grafana/plugin-ui';
import { Button, Select, Stack, useStyles2 } from '@grafana/ui';

import { QueryEditorExpressionType, QueryEditorFunctionExpression } from '../../expressions';
import { DB, QueryFormat, SQLExpression, SQLQuery } from '../../types';
import { createFunctionField } from '../../utils/sql.utils';
import { useSqlChange } from '../../utils/useSqlChange';

import { SelectFunctionParameters } from './SelectFunctionParameters';

interface SelectRowProps {
  query: SQLQuery;
  onQueryChange: (sql: SQLQuery) => void;
  db: DB;
  columns: Array<SelectableValue<string>>;
}

export function SelectRow({ query, onQueryChange, db, columns }: SelectRowProps) {
  const styles = useStyles2(getStyles);
  const { onSqlChange } = useSqlChange({ query, onQueryChange, db });
  const timeSeriesAliasOpts: Array<SelectableValue<string>> = [];

  // Add necessary alias options for time series format
  // when that format has been selected
  if (query.format === QueryFormat.Timeseries) {
    timeSeriesAliasOpts.push({ label: t('grafana-sql.components.select-row.label.time', 'time'), value: 'time' });
    timeSeriesAliasOpts.push({ label: t('grafana-sql.components.select-row.label.value', 'value'), value: 'value' });
  }

  const onAggregationChange = useCallback(
    (item: QueryEditorFunctionExpression, index: number) => (aggregation: SelectableValue<string>) => {
      const newItem = {
        ...item,
        name: aggregation?.value,
        parameters: [
          { type: QueryEditorExpressionType.FunctionParameter as const, name: item.parameters?.[0]?.name || '' },
        ],
      };
      const newSql: SQLExpression = {
        ...query.sql,
        columns: query.sql?.columns?.map((c, i) => (i === index ? newItem : c)),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, query.sql]
  );

  const onAliasChange = useCallback(
    (item: QueryEditorFunctionExpression, index: number) => (alias: SelectableValue<string>) => {
      let newItem = { ...item };

      if (alias !== null) {
        newItem = { ...item, alias: `"${alias?.value?.trim()}"` };
      } else {
        delete newItem.alias;
      }

      const newSql: SQLExpression = {
        ...query.sql,
        columns: query.sql?.columns?.map((c, i) => (i === index ? newItem : c)),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, query.sql]
  );

  const removeColumn = useCallback(
    (index: number) => () => {
      const clone = [...(query.sql?.columns || [])];
      clone.splice(index, 1);
      const newSql: SQLExpression = {
        ...query.sql,
        columns: clone,
      };
      onSqlChange(newSql);
    },
    [onSqlChange, query.sql]
  );

  const addColumn = useCallback(() => {
    const newSql: SQLExpression = { ...query.sql, columns: [...(query.sql?.columns || []), createFunctionField()] };
    onSqlChange(newSql);
  }, [onSqlChange, query.sql]);

  const aggregateOptions = () => {
    const options: Array<SelectableValue<string>> = [
      {
        label: t('grafana-sql.components.select-row.aggregate-options.options.label.aggregations', 'Aggregations'),
        options: [],
      },
      { label: t('grafana-sql.components.select-row.aggregate-options.options.label.macros', 'Macros'), options: [] },
    ];
    for (const func of db.functions()) {
      // Create groups for macros
      if (func.name.startsWith('$__')) {
        options[1].options.push({ label: func.name, value: func.name });
      } else {
        options[0].options.push({ label: func.name, value: func.name });
      }
    }
    return options;
  };

  return (
    <Stack gap={2} wrap="wrap" direction="column">
      {query.sql?.columns?.map((item, index) => (
        <div key={index}>
          <Stack gap={2} alignItems="end">
            <EditorField
              label={t('grafana-sql.components.select-row.label-data-operations', 'Data operations')}
              optional
              width={25}
            >
              <Select
                value={item.name ? toOption(item.name) : null}
                inputId={`select-aggregation-${index}-${uniqueId()}`}
                data-testid={selectors.components.SQLQueryEditor.selectAggregation}
                isClearable
                menuShouldPortal
                allowCustomValue
                options={aggregateOptions()}
                onChange={onAggregationChange(item, index)}
              />
            </EditorField>

            <SelectFunctionParameters
              currentColumnIndex={index}
              columns={columns}
              onSqlChange={onSqlChange}
              query={query}
              db={db}
            />

            <EditorField label={t('grafana-sql.components.select-row.label-alias', 'Alias')} optional width={15}>
              <Select
                value={item.alias ? toOption(item.alias) : null}
                inputId={`select-alias-${index}-${uniqueId()}`}
                data-testid={selectors.components.SQLQueryEditor.selectAlias}
                options={timeSeriesAliasOpts}
                onChange={onAliasChange(item, index)}
                isClearable
                menuShouldPortal
                allowCustomValue
              />
            </EditorField>
            <Button
              aria-label={t('grafana-sql.components.select-row.title-remove-column', 'Remove column')}
              type="button"
              icon="trash-alt"
              variant="secondary"
              size="md"
              onClick={removeColumn(index)}
            />
          </Stack>
        </div>
      ))}
      <Button
        type="button"
        onClick={addColumn}
        variant="secondary"
        aria-label={t('grafana-sql.components.select-row.title-add-column', 'Add column')}
        size="md"
        icon="plus"
        className={styles.addButton}
      />
    </Stack>
  );
}

const getStyles = () => {
  return {
    addButton: css({ alignSelf: 'flex-start' }),
    label: css({
      padding: 0,
      margin: 0,
      width: 'unset',
    }),
  };
};
