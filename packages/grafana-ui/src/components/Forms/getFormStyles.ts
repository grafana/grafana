import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '../../types';
import { getLabelStyles } from './Label';

export const getFormStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    ...getLabelStyles(theme),
  };
});
