import React, { forwardRef, MouseEvent, PropsWithChildren, ReactElement, useCallback, useMemo, useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { SelectableValue, VariableType } from '@grafana/data';
import { Button } from '@grafana/ui';
import { SelectBase } from '@grafana/ui/src/components/Select/SelectBase';
import { selectors } from '@grafana/e2e-selectors';

import { store } from '../../../store/store';
import { switchToNewMode } from './actions';
import { getVariableTypes } from '../utils';

export function UnProvidedNewVariableButton(props: PropsWithChildren<{}>): ReactElement | null {
  const dispatch = useDispatch();
  const [type, setType] = useState<VariableType>('query');
  const options = useMemo(() => getVariableTypes(), []);
  const value = options.find(o => o.value === type);
  const onUpdateType = useCallback(
    (option: SelectableValue<VariableType>) => {
      if (option?.value) {
        setType(option.value);
      }
    },
    [setType]
  );
  const onClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      dispatch(switchToNewMode(type));
    },
    [type]
  );

  if (!value) {
    return null;
  }

  return (
    <>
      <Button
        className="btn btn-primary"
        aria-label={selectors.pages.Dashboard.Settings.Variables.List.newButton}
        onClick={onClick}
      >{`New ${value.label} variable`}</Button>
      <SelectBase
        options={options}
        value={value}
        onChange={onUpdateType}
        menuPlacement="bottom"
        width={1}
        renderControl={forwardRef<any, any>(({ onBlur, onClick, value, isOpen }, ref) => {
          return <Button ref={ref} onBlur={onBlur} onClick={onClick} icon={isOpen ? 'angle-up' : 'angle-down'} />;
        })}
      />
    </>
  );
}

export function NewVariableButton(props: PropsWithChildren<{}>): ReactElement {
  return (
    <Provider store={store}>
      <UnProvidedNewVariableButton {...props} />
    </Provider>
  );
}
