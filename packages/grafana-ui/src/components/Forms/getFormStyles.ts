import { stylesFactory } from '../../themes';
import { GrafanaThemeV2 } from '@grafana/data';
import { getLabelStyles } from './Label';
import { getLegendStyles } from './Legend';
import { getFieldValidationMessageStyles } from './FieldValidationMessage';
import { getButtonStyles, ButtonVariant } from '../Button';
import { ComponentSize } from '../../types/size';
import { getInputStyles } from '../Input/Input';
import { getCheckboxStyles } from './Checkbox';

/** @deprecated */
export const getFormStyles = stylesFactory(
  (theme: GrafanaThemeV2, options: { variant: ButtonVariant; size: ComponentSize; invalid: boolean }) => {
    console.warn('getFormStyles is deprecated');

    return {
      label: getLabelStyles(theme),
      legend: getLegendStyles(theme.v1),
      fieldValidationMessage: getFieldValidationMessageStyles(theme.v1),
      button: getButtonStyles({
        theme,
        variant: options.variant,
        size: options.size,
      }),
      input: getInputStyles({ theme, invalid: options.invalid }),
      checkbox: getCheckboxStyles(theme),
    };
  }
);
