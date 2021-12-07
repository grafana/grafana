import { css } from '@emotion/css';
import { DataSourceApi, GrafanaTheme2 } from '@grafana/data';
import { Button, IconButton, useStyles2 } from '@grafana/ui';
import FlexItem from 'app/plugins/datasource/cloudwatch/components/ui/FlexItem';
import Stack from 'app/plugins/datasource/cloudwatch/components/ui/Stack';
import React from 'react';
import {
  VisualQueryModeller,
  QueryBuilderOperation,
  QueryBuilderOperationParamValue,
  QueryBuilderOperationDef,
} from '../shared/types';
import { getOperationParamEditor } from './OperationParamEditor';

export interface Props {
  operation: QueryBuilderOperation;
  index: number;
  query: any;
  datasource: DataSourceApi;
  queryModeller: VisualQueryModeller;
  onChange: (index: number, update: QueryBuilderOperation) => void;
  onRemove: (index: number) => void;
}

export function OperationEditor({ operation, index, onRemove, onChange, queryModeller, query, datasource }: Props) {
  const styles = useStyles2(getStyles);
  const def = queryModeller.getOperationDef(operation.id);

  const onParamValueChanged = (paramIdx: number, value: QueryBuilderOperationParamValue) => {
    const update: QueryBuilderOperation = { ...operation, params: [...operation.params] };
    update.params[paramIdx] = value;
    callParamChangedThenOnChange(def, update, index, paramIdx, onChange);
  };

  const onAddRestParam = () => {
    const update: QueryBuilderOperation = { ...operation, params: [...operation.params, ''] };
    callParamChangedThenOnChange(def, update, index, operation.params.length, onChange);
  };

  const onRemoveRestParam = (paramIdx: number) => {
    const update: QueryBuilderOperation = {
      ...operation,
      params: [...operation.params.slice(0, paramIdx), ...operation.params.slice(paramIdx + 1)],
    };
    callParamChangedThenOnChange(def, update, index, paramIdx, onChange);
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.name}>{def.displayName ?? def.id}</div>
        <FlexItem grow={1} />
        <IconButton name="times" size="sm" onClick={() => onRemove(index)} />
      </div>
      <div className={styles.body}>
        {operation.params.map((paramValue, index) => {
          const paramDef = def.params[Math.min(def.params.length - 1, index)];
          const Editor = getOperationParamEditor(paramDef);

          return (
            <>
              <div className={styles.paramRow} key={`${index}-1`}>
                <div className={styles.paramName}>{paramDef.name}</div>
                <div className={styles.paramValue}>
                  <Stack gap={0.5} direction="row" alignItems="center" wrap={false}>
                    <Editor
                      index={index}
                      paramDef={paramDef}
                      value={paramValue}
                      operation={operation}
                      onChange={onParamValueChanged}
                      query={query}
                      datasource={datasource}
                    />
                    {paramDef.restParam && (operation.params.length > def.params.length || paramDef.optional) && (
                      <Button
                        size="sm"
                        fill="text"
                        icon="times"
                        variant="secondary"
                        title={`Remove ${paramDef.name}`}
                        onClick={() => onRemoveRestParam(index)}
                      />
                    )}
                  </Stack>
                </div>
              </div>
              {paramDef.restParam && index === operation.params.length - 1 && (
                <div className={styles.paramRow} key={`${index}-2`}>
                  <div className={styles.paramName}></div>
                  <div className={styles.paramValue}>
                    <Button
                      size="sm"
                      fill="text"
                      icon="plus"
                      title={`Add ${paramDef.name}`}
                      variant="secondary"
                      onClick={onAddRestParam}
                    />
                  </div>
                </div>
              )}
            </>
          );
        })}
      </div>
    </div>
  );
}

function callParamChangedThenOnChange(
  def: QueryBuilderOperationDef,
  operation: QueryBuilderOperation,
  operationIndex: number,
  paramIndex: number,
  onChange: (index: number, update: QueryBuilderOperation) => void
) {
  if (def.onParamChanged) {
    onChange(operationIndex, def.onParamChanged(paramIndex, operation));
  } else {
    onChange(operationIndex, operation);
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      display: 'flex',
      flexDirection: 'column',
      cursor: 'grab',
      borderRadius: theme.shape.borderRadius(1),
    }),
    header: css({
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(0.5, 0.5, 0.5, 1),
      gap: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
    }),
    name: css({
      // fontSize: theme.typography.bodySmall.fontSize,
    }),
    infoIcon: css({
      color: theme.colors.text.secondary,
    }),
    body: css({
      margin: theme.spacing(1, 1, 0.5, 1),
      display: 'table',
    }),
    paramRow: css({
      display: 'table-row',
      verticalAlign: 'middle',
    }),
    paramName: css({
      display: 'table-cell',
      padding: theme.spacing(0, 1, 0, 0),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      verticalAlign: 'middle',
    }),
    paramValue: css({
      display: 'table-cell',
      paddingBottom: theme.spacing(0.5),
      verticalAlign: 'middle',
    }),
  };
};
