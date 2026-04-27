import { css, cx } from '@emotion/css';
import { type HTMLAttributes, useCallback, useEffect, useId, useRef } from 'react';

import { type GrafanaTheme2, type SelectableValue, toIconName } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Icon } from '../../Icon/Icon';
import { useFieldContext } from '../FieldContext';

import { type RadioButtonSize, RadioButton, RADIO_GROUP_PADDING } from './RadioButton';
export interface RadioButtonGroupProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'onClick'> {
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
  ['aria-label']?: string;
  invalid?: boolean;
}

/**
 * RadioButtonGroup is used to select a single value from multiple mutually exclusive options.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-radiobuttongroup--docs
 */
export function RadioButtonGroup<T>({
  options,
  value,
  onChange,
  onClick,
  disabled: disabledProp,
  disabledOptions,
  size = 'md',
  id: idProp,
  className,
  fullWidth = false,
  autoFocus = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedByProp,
  'aria-labelledby': ariaLabelledByProp,
  invalid: invalidProp,
  ...rest
}: RadioButtonGroupProps<T>) {
  const fieldContext = useFieldContext();
  const generatedId = useId();
  const disabled = disabledProp ?? fieldContext.disabled;
  const invalid = invalidProp ?? fieldContext.invalid;
  const internalId = idProp ?? fieldContext.id ?? generatedId;
  const ariaDescribedBy = ariaDescribedByProp ?? fieldContext['aria-describedby'];
  const ariaLabelledBy = ariaLabelledByProp ?? fieldContext['aria-labelledby'];

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

  const groupName = useRef(internalId);
  const styles = useStyles2(getStyles);

  const activeButtonRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (autoFocus && activeButtonRef.current) {
      activeButtonRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div
      {...rest}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cx(styles.radioGroup, fullWidth && styles.fullWidth, invalid && styles.invalid, className)}
    >
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
            aria-invalid={!!invalid}
            aria-describedby={ariaDescribedBy}
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
      backgroundColor: theme.colors.background.primary,
      display: 'inline-flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      border: `1px solid ${theme.components.input.borderColor}`,
      borderRadius: theme.shape.radius.default,
      padding: RADIO_GROUP_PADDING,
      '&:hover': {
        borderColor: theme.components.input.borderHover,
      },
    }),
    fullWidth: css({
      display: 'flex',
      flexGrow: 1,
    }),
    icon: css({
      marginRight: '6px',
    }),
    img: css({
      width: theme.spacing(2),
      height: theme.spacing(2),
      marginRight: theme.spacing(1),
    }),
    invalid: css({
      border: `1px solid ${theme.colors.error.border}`,
    }),
  };
};
