import { ThemePalette } from './createPalette';
import { ThemeShadows } from './createShadows';

/** @beta */
export interface ThemeComponents {
  /** Applies to normal buttons, inputs, radio buttons, etc */
  height: {
    sm: number;
    md: number;
    lg: number;
  };
  form: {
    background: string;
    border: string;
    borderHover: string;
    text: string;
  };
  panel: {
    padding: number;
    headerHeight: number;
    border: string;
    boxShadow: string;
    background: string;
  };
  dashboard: {
    background: string;
    padding: number;
  };
}

export function createComponents(palette: ThemePalette, shadows: ThemeShadows): ThemeComponents {
  const panel = {
    padding: 1,
    headerHeight: 4,
    background: palette.layer1,
    border: palette.border0,
    boxShadow: shadows.z0,
  };

  return {
    height: {
      sm: 3,
      md: 4,
      lg: 6,
    },
    form:
      palette.mode === 'dark'
        ? {
            background: palette.layer0,
            border: palette.border1,
            borderHover: palette.border2,
            text: palette.text.primary,
          }
        : {
            background: palette.layer1,
            border: palette.border1,
            borderHover: palette.border2,
            text: palette.text.primary,
          },
    panel,
    dashboard: {
      background: palette.layer0,
      padding: 1,
    },
  };
}
