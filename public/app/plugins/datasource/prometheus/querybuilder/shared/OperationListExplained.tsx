import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { useStyles2 } from '@grafana/ui';
import React from 'react';
import { QueryWithOperations, VisualQueryModeller } from './types';

export interface Props<T extends QueryWithOperations> {
  query: T;
  queryModeller: VisualQueryModeller;
  explainMode?: boolean;
}

export function OperationListExplained<T extends QueryWithOperations>({ query, queryModeller }: Props<T>) {
  const styles = useStyles2(getStyles);
  const { operations } = query;

  return (
    <Stack gap={1} direction="column">
      <div className={styles.operationList}>
        {operations.map((op, index) => {
          const def = queryModeller.getOperationDef(op.id);

          return (
            <div key={index}>
              <div>{def.name}</div>
              <div>{def.description}</div>
            </div>
          );
        })}
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      fontSize: 12,
      fontWeight: theme.typography.fontWeightMedium,
      marginBottom: 0,
    }),
    operationList: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(2),
    }),
    addButton: css({
      paddingBottom: theme.spacing(1),
    }),
  };
};
