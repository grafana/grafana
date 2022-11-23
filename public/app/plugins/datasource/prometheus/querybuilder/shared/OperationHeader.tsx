import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { FlexItem } from '@grafana/experimental';
import { Button, Select, useStyles2 } from '@grafana/ui';

import { OperationInfoButton } from './OperationInfoButton';
import { VisualQueryModeller, QueryBuilderOperation, QueryBuilderOperationDef } from './types';

export interface Props {
  operation: QueryBuilderOperation;
  def: QueryBuilderOperationDef;
  index: number;
  queryModeller: VisualQueryModeller;
  dragHandleProps: any;
  onChange: (index: number, update: QueryBuilderOperation) => void;
  onRemove: (index: number) => void;
}

interface State {
  isOpen?: boolean;
  alternatives?: Array<SelectableValue<QueryBuilderOperationDef>>;
}

export const OperationHeader = React.memo<Props>(
  ({ operation, def, index, onChange, onRemove, queryModeller, dragHandleProps }) => {
    const styles = useStyles2(getStyles);
    const [state, setState] = useState<State>({});

    const onToggleSwitcher = () => {
      if (state.isOpen) {
        setState({ ...state, isOpen: false });
      } else {
        const alternatives = queryModeller
          .getAlternativeOperations(def.alternativesKey!)
          .map((alt) => ({ label: alt.name, value: alt }));
        setState({ isOpen: true, alternatives });
      }
    };

    return (
      <div className={styles.header}>
        {!state.isOpen && (
          <>
            <div {...dragHandleProps}>{def.name ?? def.id}</div>
            <FlexItem grow={1} />
            <div className={`${styles.operationHeaderButtons} operation-header-show-on-hover`}>
              <Button
                icon="angle-down"
                size="sm"
                onClick={onToggleSwitcher}
                fill="text"
                variant="secondary"
                title="Click to view alternative operations"
              />
              <OperationInfoButton def={def} operation={operation} />
              <Button
                icon="times"
                size="sm"
                onClick={() => onRemove(index)}
                fill="text"
                variant="secondary"
                title="Remove operation"
              />
            </div>
          </>
        )}
        {state.isOpen && (
          <div className={styles.selectWrapper}>
            <Select
              autoFocus
              openMenuOnFocus
              placeholder="Replace with"
              options={state.alternatives}
              isOpen={true}
              onCloseMenu={onToggleSwitcher}
              onChange={(value) => {
                if (value.value) {
                  // Operation should exist if it is selectable
                  const newDef = queryModeller.getOperationDef(value.value.id)!;

                  // copy default params, and override with all current params
                  const newParams = [...newDef.defaultParams];
                  for (let i = 0; i < Math.min(operation.params.length, newParams.length); i++) {
                    if (newDef.params[i].type === def.params[i].type) {
                      newParams[i] = operation.params[i];
                    }
                  }

                  const changedOp = { ...operation, params: newParams, id: value.value.id };
                  onChange(index, def.changeTypeHandler ? def.changeTypeHandler(changedOp, newDef) : changedOp);
                }
              }}
            />
          </div>
        )}
      </div>
    );
  }
);

OperationHeader.displayName = 'OperationHeader';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(0.5, 0.5, 0.5, 1),
      display: 'flex',
      alignItems: 'center',
      '&:hover .operation-header-show-on-hover': css({
        opacity: 1,
      }),
    }),
    operationHeaderButtons: css({
      opacity: 0,
      transition: theme.transitions.create(['opacity'], {
        duration: theme.transitions.duration.short,
      }),
    }),
    selectWrapper: css({
      paddingRight: theme.spacing(2),
    }),
  };
};
