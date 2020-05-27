import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { getLabelStyles } from './Label';
import { getLegendStyles } from './Legend';
import { getFieldValidationMessageStyles } from './FieldValidationMessage';
import { getButtonStyles, ButtonVariant } from '../Button';
import { ComponentSize } from '../../types/size';
import { getInputStyles } from '../Input/Input';
import { getSwitchStyles } from '../Switch/Switch';
import { getCheckboxStyles } from './Checkbox';

export const getFormStyles = stylesFactory(
  (theme: GrafanaTheme, options: { variant: ButtonVariant; size: ComponentSize; invalid: boolean }) => {
    return {
      label: getLabelStyles(theme),
      legend: getLegendStyles(theme),
      fieldValidationMessage: getFieldValidationMessageStyles(theme),
      button: getButtonStyles({
        theme,
        variant: options.variant,
        size: options.size,
        hasIcon: false,
        hasText: true,
      }),
      input: getInputStyles({ theme, invalid: options.invalid }),
      switch: getSwitchStyles(theme),
      checkbox: getCheckboxStyles(theme),
    };
  }
);
