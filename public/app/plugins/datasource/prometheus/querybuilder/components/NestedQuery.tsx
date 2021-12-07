import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { FlexItem } from '@grafana/experimental';
import { IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';
import { PrometheusDatasource } from '../../datasource';
import { PromVisualQueryBinary } from '../types';
import { PromQueryBuilderInner } from './PromQueryBuilderInner';

export interface Props {
  nestedQuery: PromVisualQueryBinary;
  datasource: PrometheusDatasource;
  index: number;
  onChange: (index: number, update: PromVisualQueryBinary) => void;
  onRemove: (index: number) => void;
}

export function NestedQuery({ nestedQuery, index, datasource, onChange, onRemove }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.name}>Divide by query</div>
        <FlexItem grow={1} />
        <IconButton name="times" size="sm" onClick={() => onRemove(index)} />
      </div>
      <div className={styles.body}>
        <PromQueryBuilderInner
          query={nestedQuery.query}
          datasource={datasource}
          onChange={(update) => {
            onChange(index, { ...nestedQuery, query: update });
          }}
        />
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
