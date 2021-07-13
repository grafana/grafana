import React, { useCallback, useMemo } from 'react';
import { Button, Segment, useStyles2 } from '@grafana/ui';
import { FuncDef } from '../gfunc';
import { forEach, sortBy } from 'lodash';
import { actions } from '../state/actions';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';

type Props = {
  dispatch: any;
  funcDefs: FuncDef[];
};

export function AddGraphiteFunction({ dispatch, funcDefs }: Props) {
  const onChange = useCallback(
    ({ value }) => {
      dispatch(actions.addFunction({ name: value }));
    },
    [dispatch]
  );
  const styles = useStyles2(getStyles);

  const options = useMemo(() => createOptions(funcDefs), [funcDefs]);

  return (
    <Segment
      Component={<Button icon="plus" variant="secondary" className={cx(styles.button)} />}
      options={options}
      onChange={onChange}
      inputWidth={150}
    ></Segment>
  );
}

function createOptions(funcDefs: FuncDef[]) {
  const categories: any = {};

  forEach(funcDefs, (funcDef) => {
    if (!funcDef.category) {
      return;
    }
    if (!categories[funcDef.category]) {
      categories[funcDef.category] = { label: funcDef.category, value: funcDef.category, options: [] };
    }
    categories[funcDef.category].options.push({
      label: funcDef.name,
      value: funcDef.name,
    });
  });

  return sortBy(categories, 'label');
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css`
      margin-right: ${theme.spacing(0.5)};
    `,
  };
}
