import React, { useCallback, useRef } from 'react';
import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { RadioButtonSize, RadioButton } from './RadioButton';
import { Icon } from '../../Icon/Icon';
import { IconName } from '../../../types/icon';
import { useStyles } from '../../../themes';

export interface RadioButtonGroupProps<T> {
  value?: T;
  disabled?: boolean;
  disabledOptions?: T[];
  options: Array<SelectableValue<T>>;
  onChange?: (value: T) => void;
  size?: RadioButtonSize;
  fullWidth?: boolean;
  className?: string;
}

export function RadioButtonGroup<T>({
  options,
  value,
  onChange,
  disabled,
  disabledOptions,
  size = 'md',
  className,
  fullWidth = false,
}: RadioButtonGroupProps<T>) {
  const handleOnChange = useCallback(
    (option: SelectableValue) => {
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
  const styles = useStyles(getStyles);

  return (
    <div className={cx(styles.radioGroup, fullWidth && styles.fullWidth, className)}>
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
            description={o.description}
            fullWidth={fullWidth}
          >
            {o.icon && <Icon name={o.icon as IconName} className={styles.icon} />}
            {o.label}
          </RadioButton>
        );
      })}
    </div>
  );
}

RadioButtonGroup.displayName = 'RadioButtonGroup';

const getStyles = (theme: GrafanaTheme) => {
  return {
    radioGroup: css({
      display: 'inline-flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      border: `1px solid ${theme.v2.components.input.border}`,
      borderRadius: theme.v2.shape.borderRadius(),
      padding: '2px',
    }),
    fullWidth: css({
      display: 'flex',
    }),
    icon: css`
      margin-right: 6px;
    `,
  };
};
