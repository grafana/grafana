import { css } from '@emotion/css';
import { GrafanaTheme2, toOption } from '@grafana/data';
import { EditorRows, FlexItem } from '@grafana/experimental';
import { IconButton, Select, useStyles2 } from '@grafana/ui';
import React from 'react';
import { PrometheusDatasource } from '../../datasource';
import { AutoSizeInput } from '../shared/AutoSizeInput';
import { PromVisualQueryBinary } from '../types';
import { PromQueryBuilder } from './PromQueryBuilder';
import { binaryScalarDefs } from '../binaryScalarOperations';

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

        <AutoSizeInput
          minWidth={20}
          defaultValue={nestedQuery.vectorMatches}
          onCommitChange={(evt) => {
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
        <EditorRows>
          <PromQueryBuilder
            query={nestedQuery.query}
            datasource={datasource}
            nested={true}
            onRunQuery={onRunQuery}
            onChange={(update) => {
              onChange(index, { ...nestedQuery, query: update });
            }}
          />
        </EditorRows>
      </div>
    </div>
  );
});

const operators = binaryScalarDefs.map((def) => ({ label: def.sign, value: def.sign }));

NestedQuery.displayName = 'NestedQuery';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    header: css({
      padding: theme.spacing(0.5, 0.5, 0.5, 1),
      gap: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
    }),
    name: css({
      whiteSpace: 'nowrap',
    }),
    body: css({
      paddingLeft: theme.spacing(2),
    }),
  };
};
