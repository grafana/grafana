import { css } from '@emotion/css';
import { DataSourceApi, GrafanaTheme2 } from '@grafana/data';
import { FlexItem, Stack } from '@grafana/experimental';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import {
  VisualQueryModeller,
  QueryBuilderOperation,
  QueryBuilderOperationParamValue,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
} from '../shared/types';
import { OperationInfoButton } from './OperationInfoButton';
import { OperationName } from './OperationName';
import { getOperationParamEditor } from './OperationParamEditor';
import { getOperationParamId } from './operationUtils';

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
  if (!def) {
    return <span>Operation {operation.id} not found</span>;
  }

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
        <label className={styles.paramName} htmlFor={getOperationParamId(index, paramIndex)}>
          {paramDef.name}
        </label>
        <div className={styles.paramValue}>
          <Stack gap={0.5} direction="row" alignItems="center" wrap={false}>
            <Editor
              index={paramIndex}
              paramDef={paramDef}
              value={operation.params[paramIndex]}
              operation={operation}
              operationIndex={index}
              onChange={onParamValueChanged}
              onRunQuery={onRunQuery}
              query={query}
              datasource={datasource}
            />
            {paramDef.restParam && (operation.params.length > def.params.length || paramDef.optional) && (
              <Button
                data-testid={`operations.${index}.remove-rest-param`}
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
  let restParam: React.ReactNode | undefined;
  if (def.params.length > 0) {
    const lastParamDef = def.params[def.params.length - 1];
    if (lastParamDef.restParam) {
      restParam = renderAddRestParamButton(lastParamDef, onAddRestParam, index, operation.params.length, styles);
    }
  }

  return (
    <Draggable draggableId={`operation-${index}`} index={index}>
      {(provided) => (
        <div
          className={styles.card}
          ref={provided.innerRef}
          {...provided.draggableProps}
          data-testid={`operations.${index}.wrapper`}
        >
          <div className={styles.header} {...provided.dragHandleProps}>
            <OperationName
              operation={operation}
              def={def}
              index={index}
              onChange={onChange}
              queryModeller={queryModeller}
            />
            <FlexItem grow={1} />
            <div className={`${styles.operationHeaderButtons} operation-header-show-on-hover`}>
              <OperationInfoButton def={def} operation={operation} />
              <Button
                icon="times"
                size="sm"
                onClick={() => onRemove(index)}
                fill="text"
                variant="secondary"
                title="Remove operation"
              />
            </div>
          </div>
          <div className={styles.body}>{operationElements}</div>
          {restParam}
          {index < query.operations.length - 1 && (
            <div className={styles.arrow}>
              <div className={styles.arrowLine} />
              <div className={styles.arrowArrow} />
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

function renderAddRestParamButton(
  paramDef: QueryBuilderOperationParamDef,
  onAddRestParam: () => void,
  operationIndex: number,
  paramIndex: number,
  styles: OperationEditorStyles
) {
  return (
    <div className={styles.restParam} key={`${paramIndex}-2`}>
      <Button
        size="sm"
        icon="plus"
        title={`Add ${paramDef.name}`}
        variant="secondary"
        onClick={onAddRestParam}
        data-testid={`operations.${operationIndex}.add-rest-param`}
      >
        {paramDef.name}
      </Button>
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
      marginBottom: theme.spacing(1),
      position: 'relative',
    }),
    header: css({
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(0.5, 0.5, 0.5, 1),
      gap: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
      '&:hover .operation-header-show-on-hover': css({
        opacity: 1,
      }),
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
    operationHeaderButtons: css({
      opacity: 0,
      transition: theme.transitions.create(['opacity'], {
        duration: theme.transitions.duration.short,
      }),
    }),
    paramValue: css({
      display: 'table-cell',
      paddingBottom: theme.spacing(0.5),
      verticalAlign: 'middle',
    }),
    restParam: css({
      padding: theme.spacing(0, 1, 1, 1),
    }),
    arrow: css({
      position: 'absolute',
      top: '0',
      right: '-18px',
      display: 'flex',
    }),
    arrowLine: css({
      height: '2px',
      width: '8px',
      backgroundColor: theme.colors.border.strong,
      position: 'relative',
      top: '14px',
    }),
    arrowArrow: css({
      width: 0,
      height: 0,
      borderTop: `5px solid transparent`,
      borderBottom: `5px solid transparent`,
      borderLeft: `7px solid ${theme.colors.border.strong}`,
      position: 'relative',
      top: '10px',
    }),
  };
};

type OperationEditorStyles = ReturnType<typeof getStyles>;
