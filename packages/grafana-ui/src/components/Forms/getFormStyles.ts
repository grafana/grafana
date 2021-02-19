import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { getLabelStyles } from './Label';
import { getLegendStyles } from './Legend';
import { getFieldValidationMessageStyles } from './FieldValidationMessage';
import { getButtonStyles, ButtonVariant } from './Button';
import { ButtonSize } from '../Button/types';
import { getInputStyles } from './Input/Input';
import { getSwitchStyles } from './Switch';
import { getCheckboxStyles } from './Checkbox';

export const getFormStyles = stylesFactory(
  (theme: GrafanaTheme, options: { variant: ButtonVariant; size: ButtonSize; invalid: boolean }) => {
    return {
      label: getLabelStyles(theme),
      legend: getLegendStyles(theme),
      fieldValidationMessage: getFieldValidationMessageStyles(theme),
      button: getButtonStyles({
        theme,
        variant: options.variant,
        size: options.size,
      }),
      input: getInputStyles({ theme, invalid: options.invalid }),
      switch: getSwitchStyles(theme),
      checkbox: getCheckboxStyles(theme),
    };
  }
);
