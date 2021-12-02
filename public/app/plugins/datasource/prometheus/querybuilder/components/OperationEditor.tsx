import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import FlexItem from 'app/plugins/datasource/cloudwatch/components/ui/FlexItem';
import React from 'react';
import { visualQueryEngine } from '../engine';
import { PromVisualQueryOperation } from '../types';
import { OperationParamEditor } from './OperationParamEditor';

export interface Props {
  operation: PromVisualQueryOperation;
  index: number;
  onChange: (index: number, update: PromVisualQueryOperation) => void;
  onRemove: (index: number) => void;
}

export function OperationEditor({ operation, index, onRemove }: Props) {
  const styles = useStyles2(getStyles);
  const def = visualQueryEngine.getOperationDef(operation.id);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.name}>{def.displayName ?? def.id}</div>
        <IconButton name="info-circle" size="sm" onClick={() => {}} />

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
    body: css({
      margin: theme.spacing(1, 1, 0.5, 1),
      display: 'table',
    }),
  };
};
