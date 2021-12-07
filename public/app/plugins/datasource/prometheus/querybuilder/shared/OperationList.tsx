import { css } from '@emotion/css';
import { DataSourceApi, GrafanaTheme2 } from '@grafana/data';
import { ButtonCascader, CascaderOption, useStyles2 } from '@grafana/ui';
import Stack from 'app/plugins/datasource/cloudwatch/components/ui/Stack';
import React from 'react';
import { QueryBuilderOperation, QueryWithOperations, VisualQueryModeller } from '../shared/types';
import { OperationEditor } from './OperationEditor';

export interface Props<T extends QueryWithOperations> {
  query: T;
  datasource: DataSourceApi;
  onChange: (query: T) => void;
  queryModeller: VisualQueryModeller;
}

export function OperationList<T extends QueryWithOperations>({ query, onChange, datasource, queryModeller }: Props<T>) {
  const styles = useStyles2(getStyles);
  const { operations } = query;

  const onOperationChange = (index: number, update: QueryBuilderOperation) => {
    const updatedList = [...operations];
    updatedList.splice(index, 1, update);
    onChange({ ...query, operations: updatedList });
  };

  const onRemove = (index: number) => {
    const updatedList = [...operations.slice(0, index), ...operations.slice(index + 1)];
    onChange({ ...query, operations: updatedList });
  };

  const addOptions: CascaderOption[] = queryModeller.getCategories().map((category) => {
    return {
      value: category,
      label: category,
      children: queryModeller.getOperationsForCategory(category).map((operation) => ({
        value: operation.id,
        label: operation.displayName ?? operation.id,
        isLeaf: true,
      })),
    };
  });

  const onAddOperation = (value: string[]) => {
    const operationDef = queryModeller.getOperationDef(value[1]);
    onChange(operationDef.onAddToQuery(operationDef, query));
  };

  return (
    <Stack gap={1} direction="column">
      <h5 className={styles.heading}>Operations</h5>
      <Stack gap={0}>
        {operations.map((op, index) => (
          <div className={styles.operationWrapper} key={index.toString()}>
            <OperationEditor
              queryModeller={queryModeller}
              index={index}
              operation={op}
              query={query}
              datasource={datasource}
              onChange={onOperationChange}
              onRemove={onRemove}
            />
            {index < operations.length - 1 && (
              <>
                <div className={styles.line} />
                <div className={styles.lineArrow} />
              </>
            )}
          </div>
        ))}
        <div className={styles.addOperation}>
          <ButtonCascader key="cascader" icon="plus" options={addOptions} onChange={onAddOperation} />
        </div>
      </Stack>
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
    line: css({
      height: '2px',
      width: '8px',
      backgroundColor: theme.colors.border.strong,
      //alignSelf: 'center',
      position: 'relative',
      top: '14px',
    }),
    lineArrow: css({
      width: 0,
      height: 0,
      borderTop: `5px solid transparent`,
      borderBottom: `5px solid transparent`,
      borderLeft: `7px solid ${theme.colors.border.strong}`,
      //alignSelf: 'center',
      position: 'relative',
      top: '10px',
    }),
    operationWrapper: css({
      display: 'flex',
    }),
    addOperation: css({
      paddingLeft: theme.spacing(2),
    }),
  };
};
