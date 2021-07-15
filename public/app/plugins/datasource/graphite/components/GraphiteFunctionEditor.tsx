import React, { useState } from 'react';
import { HorizontalGroup, InlineLabel, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { FuncInstance } from '../gfunc';
import { EditableParam, FunctionParamEditor } from './FunctionParamEditor';
import { actions } from '../state/actions';
import { FunctionEditor } from '../FunctionEditor';
import { mapFuncInstanceToParams } from './helpers';

export type FunctionEditorProps = {
  func: FuncInstance;
  dispatch: (action: any) => void;
};

export function GraphiteFunctionEditor({ func, dispatch }: FunctionEditorProps) {
  const styles = useStyles2(getStyles);

  // keep track of mouse over and isExpanded state to display buttons for adding optional/multiple params
  const [mouseOver, setIsMouseOver] = useState(false);
  const [expanded, setIsExpanded] = useState(false);

  const params = mapFuncInstanceToParams(func).filter((p: EditableParam, index: number) => {
    return (index < func.def.params.length && !p.optional) || p.value || expanded || mouseOver;
  });

  return (
    <div
      className={cx(styles.container, { [styles.error]: func.def.unknown })}
      onMouseOver={() => setIsMouseOver(true)}
      onMouseLeave={() => setIsMouseOver(false)}
    >
      <HorizontalGroup spacing="none">
        <FunctionEditor
          func={func}
          onMoveLeft={() => {
            dispatch(actions.moveFunction({ func, offset: -1 }));
          }}
          onMoveRight={() => {
            dispatch(actions.moveFunction({ func, offset: 1 }));
          }}
          onRemove={() => {
            dispatch(actions.removeFunction({ func }));
          }}
        />
        <InlineLabel className={styles.label}>(</InlineLabel>
        {params.map((editableParam: EditableParam, index: number) => {
          return (
            <React.Fragment key={index}>
              <FunctionParamEditor
                autofocus={index === 0 && func.added}
                editableParam={editableParam}
                onChange={(value) => {
                  dispatch(actions.updateFunctionParam({ func, index, value }));
                  setIsExpanded(false);
                  setIsMouseOver(false);
                }}
                onExpandedChange={setIsExpanded}
              />
              {index !== params.length - 1 ? ',' : ''}
            </React.Fragment>
          );
        })}
        <InlineLabel className={styles.label}>)</InlineLabel>
      </HorizontalGroup>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.borderRadius(),
    marginRight: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)}`,
  }),
  error: css`
    border: 1px solid ${theme.colors.error.main};
  `,
  label: css({
    padding: 0,
    margin: 0,
  }),
  button: css({
    padding: theme.spacing(0.5),
  }),
});
