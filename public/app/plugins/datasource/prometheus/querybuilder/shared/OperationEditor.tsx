import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';
import FlexItem from 'app/plugins/datasource/cloudwatch/components/ui/FlexItem';
import React from 'react';
import { VisualQueryModeller, QueryBuilderOperation, QueryBuilderOperationParamValue } from '../shared/types';
import { OperationParamEditor } from './OperationParamEditor';

export interface Props {
  operation: QueryBuilderOperation;
  index: number;
  queryModeller: VisualQueryModeller;
  onChange: (index: number, update: QueryBuilderOperation) => void;
  onRemove: (index: number) => void;
}

export function OperationEditor({ operation, index, onRemove, onChange, queryModeller }: Props) {
  const styles = useStyles2(getStyles);
  const def = queryModeller.getOperationDef(operation.id);

  const onParamValueChanged = (paramIdx: number, value: QueryBuilderOperationParamValue) => {
    const updatedParams = [...operation.params];
    updatedParams[paramIdx] = value;

    onChange(index, { ...operation, params: updatedParams });
  };

  const onRemoveParam = (paramIdx: number) => {
    onChange(index, {
      ...operation,
      params: [...operation.params.slice(0, paramIdx), ...operation.params.slice(paramIdx + 1)],
    });
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.name}>{def.displayName ?? def.id}</div>
        <Icon className={styles.infoIcon} name="info-circle" size="sm" onClick={() => {}} />
        <FlexItem grow={1} />
        <IconButton name="times" size="sm" onClick={() => onRemove(index)} />
      </div>
      <div className={styles.body}>
        {operation.params.map((paramValue, index) => {
          const paramDef = def.params[Math.min(def.params.length - 1, index)];

          return (
            <OperationParamEditor
              index={index}
              key={index.toString()}
              paramDef={paramDef}
              value={paramValue}
              operation={operation}
              onChange={onParamValueChanged}
              onRemove={onRemoveParam}
            />
          );
        })}
      </div>
    </div>
  );
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
  };
};
