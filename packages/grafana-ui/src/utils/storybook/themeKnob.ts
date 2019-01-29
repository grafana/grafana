import { select } from '@storybook/addon-knobs';
import { GrafanaTheme } from '../../types';

export const getThemeKnob = (defaultTheme: GrafanaTheme = GrafanaTheme.Dark) => {
  return select(
    'Theme',
    {
      Default: defaultTheme,
      Light: GrafanaTheme.Light,
      Dark: GrafanaTheme.Dark,
    },
    defaultTheme
  );
};
