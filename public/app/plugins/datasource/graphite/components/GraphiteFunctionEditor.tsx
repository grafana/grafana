import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, InlineLabel, useStyles2 } from '@grafana/ui';

import { FuncInstance } from '../gfunc';
import { actions } from '../state/actions';
import { useDispatch } from '../state/context';

import { FunctionEditor } from './FunctionEditor';
import { EditableParam, FunctionParamEditor } from './FunctionParamEditor';
import { mapFuncInstanceToParams } from './helpers';

export type FunctionEditorProps = {
  func: FuncInstance;
};

/**
 * Allows editing function params and removing/moving a function (note: editing function name is not supported)
 */
export function GraphiteFunctionEditor({ func }: FunctionEditorProps) {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  // keep track of mouse over and isExpanded state to display buttons for adding optional/multiple params
  // only when the user mouse over over the function editor OR any param editor is expanded.
  const [mouseOver, setIsMouseOver] = useState(false);
  const [expanded, setIsExpanded] = useState(false);

  let params = mapFuncInstanceToParams(func);
  params = params.filter((p: EditableParam, index: number) => {
    // func.added is set for newly added functions - see autofocus below
    return (index < func.def.params.length && !p.optional) || func.added || p.value || expanded || mouseOver;
  });

  return (
    <div
      className={cx(styles.container, { [styles.error]: func.def.unknown })}
      onBlur={() => setIsMouseOver(false)}
      onFocus={() => setIsMouseOver(true)}
      onMouseOver={() => setIsMouseOver(true)}
      onMouseOut={() => setIsMouseOver(false)}
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
                  if (value !== '' || editableParam.optional) {
                    dispatch(actions.updateFunctionParam({ func, index, value }));
                  }
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
    height: `${theme.v1.spacing.formInputHeight}px`,
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
