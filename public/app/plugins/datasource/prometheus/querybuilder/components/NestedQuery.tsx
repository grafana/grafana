import { css } from '@emotion/css';
import { GrafanaTheme2, toOption } from '@grafana/data';
import { FlexItem } from '@grafana/experimental';
import { IconButton, Input, Select, useStyles2 } from '@grafana/ui';
import React from 'react';
import { PrometheusDatasource } from '../../datasource';
import { PromVisualQueryBinary } from '../types';
import { PromQueryBuilder } from './PromQueryBuilder';

export interface Props {
  nestedQuery: PromVisualQueryBinary;
  datasource: PrometheusDatasource;
  index: number;
  onChange: (index: number, update: PromVisualQueryBinary) => void;
  onRemove: (index: number) => void;
  onRunQuery: () => void;
}

export const NestedQuery = React.memo<Props>(({ nestedQuery, index, datasource, onChange, onRemove, onRunQuery }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.name}>Operator</div>
        <Select
          width="auto"
          options={operators}
          value={toOption(nestedQuery.operator)}
          onChange={(value) => {
            onChange(index, {
              ...nestedQuery,
              operator: value.value!,
            });
          }}
        />
        <div className={styles.name}>Vector matches</div>

        <Input
          width={20}
          defaultValue={nestedQuery.vectorMatches}
          onBlur={(evt) => {
            onChange(index, {
              ...nestedQuery,
              vectorMatches: evt.currentTarget.value,
            });
          }}
        />

        <FlexItem grow={1} />
        <IconButton name="times" size="sm" onClick={() => onRemove(index)} />
      </div>
      <div className={styles.body}>
        <PromQueryBuilder
          query={nestedQuery.query}
          datasource={datasource}
          nested={true}
          onRunQuery={onRunQuery}
          onChange={(update) => {
            onChange(index, { ...nestedQuery, query: update });
          }}
        />
      </div>
    </div>
  );
});

const operators = [
  { label: '/', value: '/' },
  { label: '*', value: '*' },
  { label: '+', value: '+' },
  { label: '==', value: '==' },
  { label: '>', value: '>' },
  { label: '<', value: '<' },
];

NestedQuery.displayName = 'NestedQuery';

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
      whiteSpace: 'nowrap',
    }),
    body: css({
      margin: theme.spacing(1, 1, 0.5, 1),
      display: 'table',
    }),
  };
};
