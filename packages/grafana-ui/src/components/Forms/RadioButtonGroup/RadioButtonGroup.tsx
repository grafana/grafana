import React, { useCallback, useRef } from 'react';
import { css } from 'emotion';
import uniqueId from 'lodash/uniqueId';
import { SelectableValue } from '@grafana/data';
import { RadioButtonSize, RadioButton } from './RadioButton';
import { Icon } from '../../Icon/Icon';

const getRadioButtonGroupStyles = () => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      position: relative;
    `,
    radioGroup: css`
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;

      label {
        border-radius: 0px;

        &:first-of-type {
          border-radius: 2px 0px 0px 2px;
        }

        &:last-of-type {
          border-radius: 0px 2px 2px 0px;
        }
      }
    `,
    icon: css`
      margin-right: 6px;
    `,
  };
};

interface RadioButtonGroupProps<T> {
  value?: T;
  disabled?: boolean;
  disabledOptions?: T[];
  options: Array<SelectableValue<T>>;
  onChange?: (value?: T) => void;
  size?: RadioButtonSize;
  fullWidth?: boolean;
}

export function RadioButtonGroup<T>({
  options,
  value,
  onChange,
  disabled,
  disabledOptions,
  size = 'md',
  fullWidth = false,
}: RadioButtonGroupProps<T>) {
  const handleOnChange = useCallback(
    (option: SelectableValue<T>) => {
      return () => {
        if (onChange) {
          onChange(option.value);
        }
      };
    },
    [onChange]
  );
  const id = uniqueId('radiogroup-');
  const groupName = useRef(id);
  const styles = getRadioButtonGroupStyles();

  return (
    <div className={styles.radioGroup}>
      {options.map((o, i) => {
        const isItemDisabled = disabledOptions && o.value && disabledOptions.includes(o.value);
        return (
          <RadioButton
            size={size}
            disabled={isItemDisabled || disabled}
            active={value === o.value}
            key={`o.label-${i}`}
            onChange={handleOnChange(o)}
            id={`option-${o.value}-${id}`}
            name={groupName.current}
            fullWidth={fullWidth}
          >
            {o.icon && <Icon name={o.icon} className={styles.icon} />}
            {o.label}
          </RadioButton>
        );
      })}
    </div>
  );
}

RadioButtonGroup.displayName = 'RadioButtonGroup';
