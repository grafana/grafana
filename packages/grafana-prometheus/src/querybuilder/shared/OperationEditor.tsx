// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/OperationEditor.tsx
import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { useEffect, useId, useState } from 'react';
import * as React from 'react';

import { DataSourceApi, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, Icon, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { getOperationParamId } from '../operationUtils';

import { OperationHeader } from './OperationHeader';
import { getOperationParamEditor } from './OperationParamEditor';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  QueryBuilderOperationParamValue,
  VisualQueryModeller,
} from './types';

export interface Props {
  operation: QueryBuilderOperation;
  index: number;
  query: any;
  datasource: DataSourceApi;
  queryModeller: VisualQueryModeller;
  onChange: (index: number, update: QueryBuilderOperation) => void;
  onRemove: (index: number) => void;
  onRunQuery: () => void;
  flash?: boolean;
  highlight?: boolean;
  timeRange?: TimeRange;
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
  flash,
  highlight,
  timeRange,
}: Props) {
  const styles = useStyles2(getStyles);
  const def = queryModeller.getOperationDef(operation.id);
  const shouldFlash = useFlash(flash);
  const id = useId();

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
        {!paramDef.hideName && (
          <div className={styles.paramName}>
            <label htmlFor={getOperationParamId(id, paramIndex)}>{paramDef.name}</label>
            {paramDef.description && (
              <Tooltip placement="top" content={paramDef.description} theme="info">
                <Icon name="info-circle" size="sm" className={styles.infoIcon} />
              </Tooltip>
            )}
          </div>
        )}
        <div className={styles.paramValue}>
          <Stack gap={0.5} direction="row" alignItems="center">
            <Editor
              index={paramIndex}
              paramDef={paramDef}
              value={operation.params[paramIndex]}
              operation={operation}
              operationId={id}
              onChange={onParamValueChanged}
              onRunQuery={onRunQuery}
              query={query}
              datasource={datasource}
              timeRange={timeRange}
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
          className={cx(styles.card, (shouldFlash || highlight) && styles.cardHighlight)}
          ref={provided.innerRef}
          {...provided.draggableProps}
          data-testid={`operations.${index}.wrapper`}
        >
          <OperationHeader
            operation={operation}
            dragHandleProps={provided.dragHandleProps}
            def={def}
            index={index}
            onChange={onChange}
            onRemove={onRemove}
            queryModeller={queryModeller}
          />
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

/**
 * When flash is switched on makes sure it is switched of right away, so we just flash the highlight and then fade
 * out.
 * @param flash
 */
function useFlash(flash?: boolean) {
  const [keepFlash, setKeepFlash] = useState(true);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (flash) {
      t = setTimeout(() => {
        setKeepFlash(false);
      }, 1000);
    } else {
      setKeepFlash(true);
    }

    return () => clearTimeout(t);
  }, [flash]);

  return keepFlash && flash;
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
        title={`Add ${paramDef.name}`.trimEnd()}
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
    cardWrapper: css({
      alignItems: 'stretch',
    }),
    error: css({
      marginBottom: theme.spacing(1),
    }),
    card: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      cursor: 'grab',
      borderRadius: theme.shape.radius.default,
      marginBottom: theme.spacing(1),
      position: 'relative',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'all 0.5s ease-in 0s',
      },
      height: '100%',
    }),
    cardError: css({
      boxShadow: `0px 0px 4px 0px ${theme.colors.warning.main}`,
      border: `1px solid ${theme.colors.warning.main}`,
    }),
    cardHighlight: css({
      boxShadow: `0px 0px 4px 0px ${theme.colors.primary.border}`,
      border: `1px solid ${theme.colors.primary.border}`,
    }),
    infoIcon: css({
      marginLeft: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      ':hover': {
        color: theme.colors.text.primary,
      },
    }),
    body: css({
      margin: theme.spacing(1, 1, 0.5, 1),
      display: 'table',
    }),
    paramRow: css({
      label: 'paramRow',
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
    paramValue: css({
      label: 'paramValue',
      display: 'table-cell',
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
