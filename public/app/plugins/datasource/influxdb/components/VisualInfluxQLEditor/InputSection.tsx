import React from 'react';
import { cx } from '@emotion/css';
import { Input } from '@grafana/ui';
import { useShadowedState } from '../useShadowedState';
import { paddingRightClass } from './styles';

type Props = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  isWide?: boolean;
  placeholder?: string;
};

const wideClassName = cx('width-14', paddingRightClass);
const notWideClassName = cx('width-8', paddingRightClass);

export const InputSection = ({ value, onChange, isWide, placeholder }: Props): JSX.Element => {
  const [currentValue, setCurrentValue] = useShadowedState(value);

  const onBlur = () => {
    // we send empty-string as undefined
    const newValue = currentValue === '' ? undefined : currentValue;
    onChange(newValue);
  };

  const className = isWide ?? false ? wideClassName : notWideClassName;

  return (
    <>
      <Input
        placeholder={placeholder}
        className={className}
        type="text"
        spellCheck={false}
        onBlur={onBlur}
        onChange={(e) => {
          setCurrentValue(e.currentTarget.value);
        }}
        value={currentValue ?? ''}
      />
    </>
  );
};
