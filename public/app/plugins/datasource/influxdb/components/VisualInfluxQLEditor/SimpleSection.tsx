import React, { FC } from 'react';
import { Input } from '@grafana/ui';
import { useShadowedState } from '../useShadowedState';
import { useUniqueId } from '../useUniqueId';

type Props = {
  name: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
};

export const SimpleSection: FC<Props> = ({ name, value, onChange }) => {
  const [currentValue, setCurrentValue] = useShadowedState(value);
  const inputId = useUniqueId();

  const onBlur = () => {
    // we send empty-string as undefined
    const newValue = currentValue === '' ? undefined : currentValue;
    onChange(newValue);
  };

  return (
    <div className="gf-form-inline">
      <label className="gf-form-label query-keyword width-9" htmlFor={inputId}>
        {name}
      </label>
      <Input
        className="width-30"
        id={inputId}
        type="text"
        spellCheck={false}
        onBlur={onBlur}
        onChange={(e) => {
          setCurrentValue(e.currentTarget.value);
        }}
        value={currentValue ?? ''}
      />
      <div className="gf-form gf-form--grow">
        <label className="gf-form-label gf-form-label--grow"></label>
      </div>
    </div>
  );
};
