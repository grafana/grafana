import React, { useCallback, useState } from 'react';
import { Button, CascaderOption, SegmentSelect } from '@grafana/ui';
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
  const [isOpen, setIsOpen] = useState(false);

  const onChange = useCallback(
    ({ value }) => {
      props.dispatch(actions.addFunction({ name: value }));
      setIsOpen(false);
    },
    [props.dispatch]
  );

  const options: CascaderOption[] = createOptions(props.funcDefs);
  return isOpen ? (
    <SegmentSelect
      options={options}
      onChange={onChange}
      onClickOutside={() => {
        setIsOpen(false);
      }}
      width={200}
    />
  ) : (
    <Button
      icon="plus"
      type="button"
      variant="secondary"
      onClick={() => {
        setIsOpen(true);
      }}
    />
  );
}
