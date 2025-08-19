import { css } from '@emotion/css';
import { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, InlineLabel, Input, Stack, useStyles2 } from '@grafana/ui';

import { QueryEditorExpressionType } from '../../expressions';
import { SQLExpression, SQLQuery } from '../../types';
import { getColumnValue } from '../../utils/sql.utils';

import { SelectColumn } from './SelectColumn';

interface Props {
  columns: Array<SelectableValue<string>>;
  query: SQLQuery;
  onSqlChange: (sql: SQLExpression) => void;
  onParameterChange: (index: number) => (value?: string) => void;
  currentColumnIndex: number;
}

export function SelectCustomFunctionParameters({
  columns,
  query,
  onSqlChange,
  onParameterChange,
  currentColumnIndex,
}: Props) {
  const styles = useStyles2(getStyles);
  const macroOrFunction = query.sql?.columns?.[currentColumnIndex];

  const addParameter = useCallback(
    (index: number) => {
      const item = query.sql?.columns?.[index];
      if (!item) {
        return;
      }

      item.parameters = item.parameters
        ? [...item.parameters, { type: QueryEditorExpressionType.FunctionParameter, name: '' }]
        : [];

      const newSql: SQLExpression = {
        ...query.sql,
        columns: query.sql?.columns?.map((c, i) => (i === index ? item : c)),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, query.sql]
  );

  const removeParameter = useCallback(
    (columnIndex: number, index: number) => {
      const item = query.sql?.columns?.[columnIndex];
      if (!item?.parameters) {
        return;
      }
      item.parameters = item.parameters?.filter((_, i) => i !== index);

      const newSql: SQLExpression = {
        ...query.sql,
        columns: query.sql?.columns?.map((c, i) => (i === columnIndex ? item : c)),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, query.sql]
  );

  function renderParameters(columnIndex: number) {
    if (!macroOrFunction?.parameters || macroOrFunction.parameters.length <= 1) {
      return null;
    }

    const paramComponents = macroOrFunction.parameters.map((param, index) => {
      // Skip the first parameter as it is the column name
      if (index === 0) {
        return null;
      }

      return (
        <Stack key={index} gap={2}>
          <InlineLabel className={styles.label}>,</InlineLabel>
          <Input
            onChange={(e) => onParameterChange(index)(e.currentTarget.value)}
            value={param.name}
            aria-label={t(
              'grafana-sql.components.select-custom-function-parameters.aria-label-parameter',
              'Parameter {{index}} for column {{columnIndex}}',
              { index, columnIndex }
            )}
            data-testid={selectors.components.SQLQueryEditor.selectInputParameter}
            addonAfter={
              <Button
                aria-label={t(
                  'grafana-sql.components.select-custom-function-parameters.render-parameters.params.title-remove-parameter',
                  'Remove parameter'
                )}
                type="button"
                icon="times"
                variant="secondary"
                size="md"
                onClick={() => removeParameter(columnIndex, index)}
              />
            }
          />
        </Stack>
      );
    });
    return paramComponents;
  }

  return (
    <>
      <InlineLabel className={styles.label}>(</InlineLabel>
      <SelectColumn
        columns={columns}
        onParameterChange={(s) => onParameterChange(0)(s)}
        value={getColumnValue(macroOrFunction?.parameters?.[0])}
      />
      {renderParameters(currentColumnIndex)}
      <Button
        type="button"
        onClick={() => addParameter(currentColumnIndex)}
        variant="secondary"
        size="md"
        icon="plus"
        aria-label={t('grafana-sql.components.select-custom-function-parameters.title-add-parameter', 'Add parameter')}
      />
      <InlineLabel className={styles.label}>)</InlineLabel>
    </>
  );
}

const getStyles = () => {
  return {
    label: css({
      padding: 0,
      margin: 0,
      width: 'unset',
    }),
  };
};
