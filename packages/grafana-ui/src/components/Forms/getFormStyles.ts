import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory } from '../../themes';
import { ComponentSize } from '../../types/size';
import { getButtonStyles, ButtonVariant } from '../Button';
import { getInputStyles } from '../Input/Input';

import { getCheckboxStyles } from './Checkbox';
import { getFieldValidationMessageStyles } from './FieldValidationMessage';
import { getLabelStyles } from './Label';
import { getLegendStyles } from './Legend';

/** @deprecated */
export const getFormStyles = stylesFactory(
  (theme: GrafanaTheme2, options: { variant: ButtonVariant; size: ComponentSize; invalid: boolean }) => {
    console.warn('getFormStyles is deprecated');

    return {
      label: getLabelStyles(theme),
      legend: getLegendStyles(theme.v1),
      fieldValidationMessage: getFieldValidationMessageStyles(theme),
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
