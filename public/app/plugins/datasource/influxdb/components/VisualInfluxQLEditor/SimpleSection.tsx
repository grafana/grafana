import React, { FC } from 'react';
import { HorizontalGroup, InlineFormLabel, Input } from '@grafana/ui';
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
    <HorizontalGroup>
      <InlineFormLabel htmlFor={inputId}>{name}</InlineFormLabel>
      <Input
        id={inputId}
        type="text"
        spellCheck={false}
        onBlur={onBlur}
        onChange={(e) => {
          setCurrentValue(e.currentTarget.value);
        }}
        value={currentValue ?? ''}
      />
    </HorizontalGroup>
  );
};
