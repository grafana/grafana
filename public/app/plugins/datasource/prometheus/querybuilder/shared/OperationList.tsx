import { css } from '@emotion/css';
import { DataSourceApi, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { ButtonCascader, CascaderOption, useStyles2 } from '@grafana/ui';
import React from 'react';
import { QueryBuilderOperation, QueryWithOperations, VisualQueryModeller } from '../shared/types';
import { OperationEditor } from './OperationEditor';

export interface Props<T extends QueryWithOperations> {
  query: T;
  datasource: DataSourceApi;
  onChange: (query: T) => void;
  onRunQuery: () => void;
  queryModeller: VisualQueryModeller;
  heading: string;
}

export function OperationList<T extends QueryWithOperations>({
  query,
  datasource,
  queryModeller,
  heading,
  onChange,
  onRunQuery,
}: Props<T>) {
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
        label: operation.name,
        isLeaf: true,
      })),
    };
  });

  const onAddOperation = (value: string[]) => {
    const operationDef = queryModeller.getOperationDef(value[1]);
    onChange(operationDef.addOperationHandler(operationDef, query, queryModeller));
  };

  return (
    <Stack gap={1} direction="column">
      {/* <h5 className={styles.heading}>{heading}</h5> */}
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
              onRunQuery={onRunQuery}
            />
            {index < operations.length - 1 && (
              <>
                <div className={styles.line} />
                <div className={styles.lineArrow} />
              </>
            )}
          </div>
        ))}
        <div className={operations.length > 0 ? styles.addOperationPadding : undefined}>
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
    addOperationPadding: css({
      paddingLeft: theme.spacing(2),
    }),
  };
};
