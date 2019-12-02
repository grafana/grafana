import React from 'react';
import { css } from 'emotion';
import { SelectableValue } from '@grafana/data';
import { RadioButtonSize, RadioButton } from './RadioButton';

const getRadioButtonGroupStyles = () => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      position: relative;
    `,
  };
};
interface RadioButtonGroupProps<T> {
  value: T;
  disabled?: boolean;
  disabledOptions?: T[];
  options: Array<SelectableValue<T>>;
  onChange: (value?: T) => void;
  size?: RadioButtonSize;
}

export function RadioButtonGroup<T>({
  options,
  value,
  onChange,
  disabled,
  disabledOptions,
  size = 'md',
}: RadioButtonGroupProps<T>) {
  const styles = getRadioButtonGroupStyles();

  return (
    <div className={styles.wrapper}>
      {options.map(o => {
        const isItemDisabled = !!disabledOptions && disabledOptions.indexOf(value) > -1;
        return (
          <RadioButton
            size={size}
            disabled={disabled || isItemDisabled}
            active={value === o.value}
            key={o.label}
            onClick={() => {
              onChange(o.value);
            }}
          >
            {o.label}
          </RadioButton>
        );
      })}
    </div>
  );
}

RadioButtonGroup.displayName = 'RadioButtonGroup';
