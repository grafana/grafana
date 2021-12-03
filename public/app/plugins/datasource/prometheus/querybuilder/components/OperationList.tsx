import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { ButtonCascader, CascaderOption, useStyles2 } from '@grafana/ui';
import Stack from 'app/plugins/datasource/cloudwatch/components/ui/Stack';
import React from 'react';
import { visualQueryEngine } from '../engine';
import { getDefaultTestQuery, operationTopLevelCategories, PromVisualQuery, PromVisualQueryOperation } from '../types';
import { OperationEditor } from './OperationEditor';

export interface Props {
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
}

export function OperationList({ query, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const { operations } = query;

  const onOperationChange = (index: number, update: PromVisualQueryOperation) => {
    const updatedList = [...operations];
    updatedList.splice(index, 1, update);
    onChange({ ...query, operations: updatedList });
  };

  const onRemove = (index: number) => {
    const updatedList = [...operations.slice(0, index), ...operations.slice(index + 1)];
    onChange({ ...query, operations: updatedList });
  };

  const addOptions: CascaderOption[] = operationTopLevelCategories.map((category) => {
    return {
      value: category,
      label: category,
      children: visualQueryEngine.getOperationsForCategory(category).map((operation) => ({
        value: operation.id,
        label: operation.displayName ?? operation.id,
        isLeaf: true,
      })),
    };
  });

  const onAddOperation = (value: string[]) => {
    // Temporary hacky way to add sub queries
    if (value[1] === '__divide_by_sub_query') {
      onChange({
        ...query,
        nestedQueries: [
          ...(query.nestedQueries ?? []),
          {
            operator: '/',
            query: getDefaultTestQuery(),
          },
        ],
      });
      return;
    }

    const operation = visualQueryEngine.getOperationDef(value[1]);
    const newOperation: PromVisualQueryOperation = {
      id: operation.id,
      params: operation.defaultParams,
    };

    onChange({
      ...query,
      operations: [...operations, newOperation],
    });
  };

  return (
    <Stack gap={1} direction="column">
      <h5 className={styles.heading}>Operations</h5>
      <Stack gap={0}>
        {operations.map((op, index) => (
          <>
            <OperationEditor
              key={index.toString()}
              index={index}
              operation={op}
              onChange={onOperationChange}
              onRemove={onRemove}
            />
            {index < operations.length - 1 && (
              <>
                <div className={styles.line} />
                <div className={styles.lineArrow} />
              </>
            )}
          </>
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
    }),
    line: css({
      height: '2px',
      width: '8px',
      backgroundColor: theme.colors.text.disabled,
      alignSelf: 'center',
    }),
    lineArrow: css({
      width: 0,
      height: 0,
      borderTop: `5px solid transparent`,
      borderBottom: `5px solid transparent`,
      borderLeft: `7px solid ${theme.colors.text.disabled}`,
      alignSelf: 'center',
    }),
    addOperation: css({
      paddingLeft: theme.spacing(2),
    }),
  };
};
