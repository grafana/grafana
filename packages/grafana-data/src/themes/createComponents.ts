import { ThemeColors } from './createColors';
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

export function createComponents(colors: ThemeColors, shadows: ThemeShadows): ThemeComponents {
  const panel = {
    padding: 1,
    headerHeight: 4,
    background: colors.background.primary,
    border: colors.background.primary,
    boxShadow: shadows.z0,
  };

  return {
    height: {
      sm: 3,
      md: 4,
      lg: 6,
    },
    input:
      colors.mode === 'dark'
        ? {
            background: colors.background.canvas,
            border: colors.border.medium,
            borderHover: colors.border.strong,
            text: colors.text.primary,
          }
        : {
            background: colors.background.primary,
            border: colors.border.medium,
            borderHover: colors.border.strong,
            text: colors.text.primary,
          },
    panel,
    tooltip: {
      background: colors.background.secondary,
      text: colors.text.primary,
    },
    dashboard: {
      background: colors.background.canvas,
      padding: 1,
    },
  };
}
