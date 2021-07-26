import React, { useCallback, useMemo } from 'react';
import { Button, Segment, useStyles2 } from '@grafana/ui';
import { FuncDefs } from '../gfunc';
import { actions } from '../state/actions';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { mapFuncDefsToSelectables } from './helpers';
import { Dispatch } from 'redux';

type Props = {
  dispatch: Dispatch;
  funcDefs: FuncDefs;
};

export function AddGraphiteFunction({ dispatch, funcDefs }: Props) {
  const onChange = useCallback(
    ({ value }) => {
      dispatch(actions.addFunction({ name: value }));
    },
    [dispatch]
  );
  const styles = useStyles2(getStyles);

  const options = useMemo(() => mapFuncDefsToSelectables(funcDefs), [funcDefs]);

  return (
    <Segment
      Component={<Button icon="plus" variant="secondary" className={cx(styles.button)} />}
      options={options}
      onChange={onChange}
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
