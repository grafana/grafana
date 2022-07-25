import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useCallback, useEffect, useRef } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { IconName } from '../../../types/icon';
import { Icon } from '../../Icon/Icon';

import { RadioButtonSize, RadioButton } from './RadioButton';

export interface RadioButtonGroupProps<T> {
  value?: T;
  id?: string;
  disabled?: boolean;
  disabledOptions?: T[];
  options: Array<SelectableValue<T>>;
  onChange?: (value: T) => void;
  onClick?: (value: T) => void;
  size?: RadioButtonSize;
  fullWidth?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function RadioButtonGroup<T>({
  options,
  value,
  onChange,
  onClick,
  disabled,
  disabledOptions,
  size = 'md',
  id,
  className,
  fullWidth = false,
  autoFocus = false,
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
  const handleOnClick = useCallback(
    (option: SelectableValue) => {
      return () => {
        if (onClick) {
          onClick(option.value);
        }
      };
    },
    [onClick]
  );

  const internalId = id ?? uniqueId('radiogroup-');
  const groupName = useRef(internalId);
  const styles = useStyles2(getStyles);

  const activeButtonRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (autoFocus && activeButtonRef.current) {
      activeButtonRef.current.focus();
    }
  }, [autoFocus]);

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
            aria-label={o.ariaLabel}
            onChange={handleOnChange(o)}
            onClick={handleOnClick(o)}
            id={`option-${o.value}-${internalId}`}
            name={groupName.current}
            description={o.description}
            fullWidth={fullWidth}
            ref={value === o.value ? activeButtonRef : undefined}
          >
            {o.icon && <Icon name={o.icon as IconName} className={styles.icon} />}
            {o.imgUrl && <img src={o.imgUrl} alt={o.label} className={styles.img} />}
            {o.label} {o.component ? <o.component /> : null}
          </RadioButton>
        );
      })}
    </div>
  );
}

RadioButtonGroup.displayName = 'RadioButtonGroup';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    radioGroup: css({
      display: 'inline-flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      border: `1px solid ${theme.components.input.borderColor}`,
      borderRadius: theme.shape.borderRadius(),
      padding: '2px',
    }),
    fullWidth: css({
      display: 'flex',
    }),
    icon: css`
      margin-right: 6px;
    `,
    img: css`
      width: ${theme.spacing(2)};
      height: ${theme.spacing(2)};
      margin-right: ${theme.spacing(1)};
    `,
  };
};
