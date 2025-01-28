import { css } from '@emotion/css';
import { useCallback, useEffect, useId, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorField } from '@grafana/plugin-ui';
import { InlineLabel, Input, Select, Stack, useStyles2 } from '@grafana/ui';

import { QueryEditorExpressionType } from '../../expressions';
import { DB, SQLExpression, SQLQuery } from '../../types';
import { getColumnValue } from '../../utils/sql.utils';

import { SelectColumn } from './SelectColumn';
import { SelectCustomFunctionParameters } from './SelectCustomFunctionParameters';

interface Props {
  query: SQLQuery;
  onSqlChange: (sql: SQLExpression) => void;
  currentColumnIndex: number;
  db: DB;
  columns: Array<SelectableValue<string>>;
}

export function SelectFunctionParameters({ query, onSqlChange, currentColumnIndex, db, columns }: Props) {
  const selectInputId = useId();
  const macroOrFunction = query.sql?.columns?.[currentColumnIndex];
  const styles = useStyles2(getStyles);
  const func = db.functions().find((f) => f.name === macroOrFunction?.name);

  const [fieldsFromFunction, setFieldsFromFunction] = useState<Array<Array<SelectableValue<string>>>>([]);

  useEffect(() => {
    const getFieldsFromFunction = async () => {
      if (!func) {
        return;
      }
      const options: Array<Array<SelectableValue<string>>> = [];
      for (const param of func.parameters ?? []) {
        if (param.options) {
          options.push(await param.options(query));
        } else {
          options.push([]);
        }
      }
      setFieldsFromFunction(options);
    };
    getFieldsFromFunction();

    // It is fine to ignore the warning here and omit the query object
    // only table property is used in the query object and whenever table changes the component is re-rendered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macroOrFunction?.name]);

  const onParameterChange = useCallback(
    (index: number, keepIndex?: boolean) => (s: string | undefined) => {
      const item = query.sql?.columns?.[currentColumnIndex];
      if (!item) {
        return;
      }
      if (!item.parameters) {
        item.parameters = [];
      }
      if (item.parameters[index] === undefined) {
        item.parameters[index] = { type: QueryEditorExpressionType.FunctionParameter, name: s };
      } else if (s == null && keepIndex) {
        // Remove value from index
        item.parameters = item.parameters.map((p, i) => (i === index ? { ...p, name: '' } : p));
        // Remove the last empty parameter
        if (item.parameters[item.parameters.length - 1]?.name === '') {
          item.parameters = item.parameters.filter((p) => p.name !== '');
        }
      } else if (s == null) {
        item.parameters = item.parameters.filter((_, i) => i !== index);
      } else {
        item.parameters = item.parameters.map((p, i) => (i === index ? { ...p, name: s } : p));
      }

      const newSql: SQLExpression = {
        ...query.sql,
        columns: query.sql?.columns?.map((c, i) => (i === currentColumnIndex ? item : c)),
      };

      onSqlChange(newSql);
    },
    [currentColumnIndex, onSqlChange, query.sql]
  );

  function renderParametersWithFunctions() {
    if (!func?.parameters) {
      return null;
    }

    return func?.parameters.map((funcParam, index) => {
      return (
        <Stack key={index} alignItems="flex-end" gap={2}>
          <EditorField label={funcParam.name} width={25} optional={!funcParam.required}>
            <>
              {funcParam.options ? (
                <Select
                  value={getColumnValue(macroOrFunction?.parameters![index])}
                  options={fieldsFromFunction?.[index]}
                  data-testid={selectors.components.SQLQueryEditor.selectFunctionParameter(funcParam.name)}
                  inputId={selectInputId}
                  menuShouldPortal
                  allowCustomValue
                  isClearable
                  onChange={(s) => onParameterChange(index, true)(s?.value)}
                />
              ) : (
                <Input
                  onChange={(e) => onParameterChange(index, true)(e.currentTarget.value)}
                  value={macroOrFunction?.parameters![index]?.name}
                  data-testid={selectors.components.SQLQueryEditor.selectInputParameter}
                />
              )}
            </>
          </EditorField>
          {func.parameters!.length !== index + 1 && <InlineLabel className={styles.label}>,</InlineLabel>}
        </Stack>
      );
    });
  }

  // This means that no function is selected, we render a column selector
  if (macroOrFunction?.name === undefined) {
    return (
      <SelectColumn
        columns={columns}
        onParameterChange={(s) => onParameterChange(0)(s)}
        value={getColumnValue(macroOrFunction?.parameters?.[0])}
      />
    );
  }

  // If the function is not found, that means that it might be a custom value
  // we let the user add any number of parameters
  if (!func) {
    return (
      <SelectCustomFunctionParameters
        query={query}
        onSqlChange={onSqlChange}
        currentColumnIndex={currentColumnIndex}
        columns={columns}
        onParameterChange={onParameterChange}
      />
    );
  }

  // Else we render the function parameters based on the provided settings
  return (
    <>
      <InlineLabel className={styles.label}>(</InlineLabel>
      {renderParametersWithFunctions()}
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
