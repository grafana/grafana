import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, toOption } from '@grafana/data';
import { EditorRows, FlexItem } from '@grafana/experimental';
import { AutoSizeInput, IconButton, Select, useStyles2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { binaryScalarDefs } from '../binaryScalarOperations';
import { PromVisualQueryBinary } from '../types';

import { PromQueryBuilder } from './PromQueryBuilder';

export interface Props {
  nestedQuery: PromVisualQueryBinary;
  datasource: PrometheusDatasource;
  index: number;
  onChange: (index: number, update: PromVisualQueryBinary) => void;
  onRemove: (index: number) => void;
  onRunQuery: () => void;
  showExplain: boolean;
}

export const NestedQuery = React.memo<Props>((props) => {
  const { nestedQuery, index, datasource, onChange, onRemove, onRunQuery, showExplain } = props;
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
        <div className={styles.vectorMatchWrapper}>
          <Select<PromVisualQueryBinary['vectorMatchesType']>
            width="auto"
            value={nestedQuery.vectorMatchesType || 'on'}
            allowCustomValue
            options={[
              { value: 'on', label: 'on' },
              { value: 'ignoring', label: 'ignoring' },
            ]}
            onChange={(val) => {
              onChange(index, {
                ...nestedQuery,
                vectorMatchesType: val.value,
              });
            }}
          />
          <AutoSizeInput
            className={styles.vectorMatchInput}
            minWidth={20}
            defaultValue={nestedQuery.vectorMatches}
            onCommitChange={(evt) => {
              onChange(index, {
                ...nestedQuery,
                vectorMatches: evt.currentTarget.value,
                vectorMatchesType: nestedQuery.vectorMatchesType || 'on',
              });
            }}
          />
        </div>
        <FlexItem grow={1} />
        <IconButton name="times" size="sm" onClick={() => onRemove(index)} tooltip="Remove match" />
      </div>
      <div className={styles.body}>
        <EditorRows>
          <PromQueryBuilder
            showExplain={showExplain}
            query={nestedQuery.query}
            datasource={datasource}
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
      label: 'card',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    header: css({
      label: 'header',
      padding: theme.spacing(0.5, 0.5, 0.5, 1),
      gap: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
    }),
    name: css({
      label: 'name',
      whiteSpace: 'nowrap',
    }),
    body: css({
      label: 'body',
      paddingLeft: theme.spacing(2),
    }),
    vectorMatchInput: css({
      label: 'vectorMatchInput',
      marginLeft: -1,
    }),
    vectorMatchWrapper: css({
      label: 'vectorMatchWrapper',
      display: 'flex',
    }),
  };
};
