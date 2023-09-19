import { css } from '@emotion/css';
import React, { useId } from 'react';

import { DataSourceApi, GrafanaTheme2, toOption } from '@grafana/data';
import { EditorRows, FlexItem } from '@grafana/experimental';
import { AutoSizeInput, IconButton, Select, useStyles2 } from '@grafana/ui';

import { getOperationParamEditor } from '../../../prometheus/querybuilder/shared/OperationParamEditor';
import { QueryBuilderOperation, QueryBuilderOperationParamDef } from '../../../prometheus/querybuilder/shared/types';
import { LokiDatasource } from '../../datasource';
import { LokiQueryModeller } from '../LokiQueryModeller';
import { binaryScalarDefs } from '../binaryScalarOperations';
import { LokiVisualQuery, LokiVisualQueryBinary } from '../types';

import { LokiQueryBuilder } from './LokiQueryBuilder';

export interface Props {
  query: LokiVisualQuery;
  operations: QueryBuilderOperation[];
  nestedQuery: LokiVisualQueryBinary;
  datasource: LokiDatasource;
  index: number;
  showExplain: boolean;
  onChange: (index: number, update: LokiVisualQueryBinary) => void;
  onRemove: (index: number) => void;
  onRunQuery: () => void;
  queryModeller: LokiQueryModeller;
}

const booleanComparisonOperator: QueryBuilderOperationParamDef = {
  name: 'Bool',
  type: 'boolean',
  description: 'If checked comparison will return 0 or 1 for the value rather than filtering.',
};

export const NestedQuery = React.memo<Props>(
  ({ nestedQuery, index, datasource, onChange, onRemove, onRunQuery, showExplain, operations, query }) => {
    const styles = useStyles2(getStyles);
    const paramIndex = 0; // should only be a single param with this? TODO fix
    console.log('');
    console.log('nestedQuery', nestedQuery);
    console.log('operations', operations);
    console.log('query', query);

    const paramDef = booleanComparisonOperator;
    const Editor = getOperationParamEditor(paramDef);
    const id = useId();

    const onParamValueChanged = (e) => {
      console.log('onParamValueChanged TODO', e);
    };

    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.name}>Operator</div>
          <Select
            aria-label="Select operator"
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
            <Select<LokiVisualQueryBinary['vectorMatchesType']>
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
          <Editor
            index={paramIndex}
            paramDef={paramDef}
            value={nestedQuery.boolModifier}
            operation={operations[index]}
            operationId={id}
            onChange={onParamValueChanged}
            onRunQuery={onRunQuery}
            query={query}
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            datasource={datasource as DataSourceApi}
          />
          <FlexItem grow={1} />
          <IconButton name="times" size="sm" onClick={() => onRemove(index)} tooltip="Remove nested query" />
        </div>
        <div className={styles.body}>
          <EditorRows>
            <LokiQueryBuilder
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
  }
);

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
