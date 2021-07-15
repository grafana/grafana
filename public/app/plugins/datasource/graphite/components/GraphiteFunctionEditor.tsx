import React, { useState } from 'react';
import { HorizontalGroup, InlineLabel, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { FuncInstance, ParamDef } from '../gfunc';
import { FieldEditor } from './FieldEditor';
import { actions } from '../state/actions';
import { FunctionEditor } from '../FunctionEditor';

export type FunctionEditorProps = {
  func: FuncInstance;
  dispatch: (action: any) => void;
};

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
  segment: css({
    margin: 0,
    padding: 0,
  }),
  input: css({
    margin: 0,
    padding: 0,
    height: theme.components.height.sm,
  }),
  button: css({
    padding: theme.spacing(0.5),
  }),
});

type ParamToShow = {
  optional: boolean;
  multiple: boolean;
  options: string[];
  name: string;
  value: string;
};

export function GraphiteFunctionEditor({ func, dispatch }: FunctionEditorProps) {
  const styles = useStyles2(getStyles);

  let params: ParamToShow[] = func.def.params.map((paramDef: ParamDef, index: number) => {
    const value = func.params[index];
    return {
      name: paramDef.name,
      value: value.toString(),
      optional: !!paramDef.optional,
      options: paramDef.options?.map((option) => option.toString()) || [],
      multiple: !!paramDef.multiple,
    };
  });
  while (params.length < func.params.length) {
    const paramDef = func.def.params[func.def.params.length - 1];
    const value = func.params[params.length];

    params.push({
      name: paramDef.name,
      optional: !!paramDef.optional,
      multiple: !!paramDef.multiple,
      value: value.toString(),
      options: paramDef.options?.map((option) => option.toString()) || [],
    });
  }

  // all params are defined and the last one allows adding multiples values
  if (params.length && params[params.length - 1].value && params[params.length - 1]?.multiple) {
    const paramDef = func.def.params[func.def.params.length - 1];
    params.push({
      name: paramDef.name,
      optional: !!paramDef.optional,
      multiple: !!paramDef.multiple,
      value: '',
      options: paramDef.options?.map((option) => option.toString()) || [],
    });
  }

  const [mouseOver, setMouseOver] = useState(false);
  const [expanded, setExpanded] = useState(false);

  params = params.filter(
    (p: ParamToShow, index: number) =>
      (index < func.def.params.length && p.optional !== true) || p.value || expanded || mouseOver
  );

  return (
    <div
      className={cx(styles.container, { [styles.error]: func.def.unknown })}
      onMouseOver={() => setMouseOver(true)}
      onMouseLeave={() => setMouseOver(false)}
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
        {params.map((param: ParamToShow, index: number) => {
          return (
            <React.Fragment key={index}>
              <FieldEditor
                autofocus={index === 0 && func.added}
                value={param.value}
                name={param.name}
                options={param.options}
                styles={styles}
                onChange={(value) => {
                  dispatch(actions.updateFunctionParam({ func, index, value }));
                  setExpanded(false);
                  setMouseOver(false);
                }}
                onExpandedChange={setExpanded}
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
