import React, { useEffect, useMemo, useState } from 'react';
import { Button, Segment, useStyles2 } from '@grafana/ui';
import { FuncDefs } from '../gfunc';
import { actions } from '../state/actions';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { mapFuncDefsToSelectables } from './helpers';
import { Dispatch } from 'redux';

type Props = {
  dispatch: Dispatch;
  funcDefs: FuncDefs;
};

export function AddGraphiteFunction({ dispatch, funcDefs }: Props) {
  const [value, setValue] = useState<SelectableValue<string> | undefined>(undefined);
  const styles = useStyles2(getStyles);

  const options = useMemo(() => mapFuncDefsToSelectables(funcDefs), [funcDefs]);

  // Note: actions.addFunction will add a component that will have a dropdown or input in auto-focus
  // (the first param of the function). This auto-focus will cause onBlur() on AddGraphiteFunction's
  // Segment component and trigger onChange once again. (why? we call onChange if the user dismissed
  // the dropdown, see: SegmentSelect.onCloseMenu for more details). To avoid it we need to wait for
  // the Segment to disappear first (hence useEffect) and then dispatch the action that will add new
  // components.
  useEffect(() => {
    if (value?.value !== undefined) {
      dispatch(actions.addFunction({ name: value.value }));
      setValue(undefined);
    }
  }, [value, dispatch]);

  return (
    <Segment
      Component={<Button icon="plus" variant="secondary" className={cx(styles.button)} />}
      options={options}
      onChange={setValue}
      inputMinWidth={150}
    ></Segment>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css`
      margin-right: ${theme.spacing(0.5)};
    `,
  };
}
