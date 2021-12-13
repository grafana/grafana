import { css } from '@emotion/css';
import { DataSourceApi, GrafanaTheme2 } from '@grafana/data';
import { FlexItem, Stack } from '@grafana/experimental';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';
import {
  VisualQueryModeller,
  QueryBuilderOperation,
  QueryBuilderOperationParamValue,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
} from '../shared/types';
import { OperationName } from './OperationName';
import { getOperationParamEditor } from './OperationParamEditor';

export interface Props {
  operation: QueryBuilderOperation;
  index: number;
  query: any;
  datasource: DataSourceApi;
  queryModeller: VisualQueryModeller;
  onChange: (index: number, update: QueryBuilderOperation) => void;
  onRemove: (index: number) => void;
  onRunQuery: () => void;
}

export function OperationEditor({
  operation,
  index,
  onRemove,
  onChange,
  onRunQuery,
  queryModeller,
  query,
  datasource,
}: Props) {
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

  const operationElements: React.ReactNode[] = [];

  for (let paramIndex = 0; paramIndex < operation.params.length; paramIndex++) {
    const paramDef = def.params[Math.min(def.params.length - 1, paramIndex)];
    const Editor = getOperationParamEditor(paramDef);

    operationElements.push(
      <div className={styles.paramRow} key={`${paramIndex}-1`}>
        <div className={styles.paramName}>{paramDef.name}</div>
        <div className={styles.paramValue}>
          <Stack gap={0.5} direction="row" alignItems="center" wrap={false}>
            <Editor
              index={paramIndex}
              paramDef={paramDef}
              value={operation.params[paramIndex]}
              operation={operation}
              onChange={onParamValueChanged}
              onRunQuery={onRunQuery}
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
                onClick={() => onRemoveRestParam(paramIndex)}
              />
            )}
          </Stack>
        </div>
      </div>
    );
  }

  // Handle adding button for rest params
  if (def.params.length > 0) {
    const lastParamDef = def.params[def.params.length - 1];
    if (lastParamDef.restParam) {
      operationElements.push(renderAddRestParamButton(lastParamDef, onAddRestParam, operation.params.length, styles));
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <OperationName
          operation={operation}
          def={def}
          index={index}
          onChange={onChange}
          queryModeller={queryModeller}
        />
        <FlexItem grow={1} />
        <div>
          {/* <Button icon="info-circle" size="sm" variant="secondary" fill="text" className={styles.headerButton} /> */}
          <Button
            icon="times"
            size="sm"
            onClick={() => onRemove(index)}
            fill="text"
            className={styles.headerButton}
            variant="secondary"
            title="Remove operation"
          />
        </div>
      </div>
      <div className={styles.body}>{operationElements}</div>
    </div>
  );
}

function renderAddRestParamButton(
  paramDef: QueryBuilderOperationParamDef,
  onAddRestParam: () => void,
  paramIndex: number,
  styles: OperationEditorStyles
) {
  return (
    <div className={styles.paramRow} key={`${paramIndex}-2`}>
      <div className={styles.paramName}>
        <Button size="sm" icon="plus" title={`Add ${paramDef.name}`} variant="secondary" onClick={onAddRestParam} />
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
  if (def.paramChangedHandler) {
    onChange(operationIndex, def.paramChangedHandler(paramIndex, operation, def));
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
      height: '32px',
    }),
    headerButton: css({
      color: theme.colors.text.secondary,
    }),
    paramValue: css({
      display: 'table-cell',
      paddingBottom: theme.spacing(0.5),
      verticalAlign: 'middle',
    }),
  };
};

type OperationEditorStyles = ReturnType<typeof getStyles>;
