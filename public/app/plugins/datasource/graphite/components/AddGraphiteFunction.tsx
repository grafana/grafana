import React, { useCallback, useMemo } from 'react';
import { Button, Segment } from '@grafana/ui';
import { FuncDef } from '../gfunc';
import { forEach, sortBy } from 'lodash';
import { actions } from '../state/actions';

type Props = {
  dispatch: any;
  funcDefs: FuncDef[];
};

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

export function AddGraphiteFunction(props: Props) {
  const onChange = useCallback(
    ({ value }) => {
      props.dispatch(actions.addFunction({ name: value }));
    },
    [props.dispatch]
  );

  const options = useMemo(() => createOptions(props.funcDefs), [props.funcDefs]);

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
