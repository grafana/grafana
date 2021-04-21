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
  input: {
    background: string;
    border: string;
    borderHover: string;
    text: string;
  };
  tooltip: {
    text: string;
    background: string;
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
    background: palette.background.primary,
    border: palette.background.primary,
    boxShadow: shadows.z0,
  };

  return {
    height: {
      sm: 3,
      md: 4,
      lg: 6,
    },
    input:
      palette.mode === 'dark'
        ? {
            background: palette.background.canvas,
            border: palette.border.medium,
            borderHover: palette.border.strong,
            text: palette.text.primary,
          }
        : {
            background: palette.background.primary,
            border: palette.border.medium,
            borderHover: palette.border.strong,
            text: palette.text.primary,
          },
    panel,
    tooltip: {
      background: palette.background.secondary,
      text: palette.text.primary,
    },
    dashboard: {
      background: palette.background.canvas,
      padding: 1,
    },
  };
}
