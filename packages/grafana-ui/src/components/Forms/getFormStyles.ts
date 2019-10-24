import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '../../types';
import { getLabelStyles } from './Label';
import { getLegendStyles } from './Legend';
import { getFieldValidationMessageStyles } from './FieldValidationMessage';
import { getButtonStyles } from './Button';

export const getFormStyles = stylesFactory((theme: GrafanaTheme, options?: any) => {
  return {
    ...getLabelStyles(theme),
    ...getLegendStyles(theme),
    ...getFieldValidationMessageStyles(theme),
    ...getButtonStyles({ theme, variant: options.variant, size: options.size, withIcon: options.withIcon }),
  };
});
