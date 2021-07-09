import React, { useCallback, useMemo } from 'react';
import { Button, Segment } from '@grafana/ui';
import { FuncDef } from '../gfunc';
import { forEach, sortBy } from 'lodash';
import { actions } from '../state/actions';

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

  const options = useMemo(() => createOptions(funcDefs), [funcDefs]);

  return (
    <Segment
      Component={<Button icon="plus" variant="secondary" />}
      options={options}
      onChange={onChange}
      inputWidth={150}
      submitOnClickAway={false}
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
