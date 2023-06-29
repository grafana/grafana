import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useCallback, useEffect, useRef } from 'react';

import { GrafanaTheme2, SelectableValue, toIconName } from '@grafana/data';

import { useStyles2 } from '../../../themes';
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
  invalid?: boolean;
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
  invalid = false,
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
    <div className={cx(styles.radioGroup, fullWidth && styles.fullWidth, invalid && styles.invalid, className)}>
      {options.map((opt, i) => {
        const isItemDisabled = disabledOptions && opt.value && disabledOptions.includes(opt.value);
        const icon = opt.icon ? toIconName(opt.icon) : undefined;
        const hasNonIconPart = Boolean(opt.imgUrl || opt.label || opt.component);

        return (
          <RadioButton
            size={size}
            disabled={isItemDisabled || disabled}
            active={value === opt.value}
            key={`o.label-${i}`}
            aria-label={opt.ariaLabel}
            onChange={handleOnChange(opt)}
            onClick={handleOnClick(opt)}
            id={`option-${opt.value}-${internalId}`}
            name={groupName.current}
            description={opt.description}
            fullWidth={fullWidth}
            ref={value === opt.value ? activeButtonRef : undefined}
          >
            {icon && <Icon name={icon} className={cx(hasNonIconPart && styles.icon)} />}
            {opt.imgUrl && <img src={opt.imgUrl} alt={opt.label} className={styles.img} />}
            {opt.label} {opt.component ? <opt.component /> : null}
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
    invalid: css({
      border: `1px solid ${theme.colors.error.border}`,
    }),
  };
};
