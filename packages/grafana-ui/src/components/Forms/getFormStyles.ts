import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '../../types';
import { getLabelStyles } from './Label';
import { getLegendStyles } from './Legend';

export const getFormStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    ...getLabelStyles(theme),
    ...getLegendStyles(theme),
  };
});
