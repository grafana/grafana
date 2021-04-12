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
  tooltip: {
    background: string;
    text: string;
  };
  menu: {
    background: string;
  };
  dropdown: {
    background: string;
  };
  scrollbar: {
    background: string;
  };
  form: {
    background: string;
    border: string;
    borderHover: string;
    text: string;
  };
  card: {
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
  pageToolbar: {
    background: string;
    boxShadow: string;
    border: string;
  };
}

export function createComponents(palette: ThemePalette, shadows: ThemeShadows): ThemeComponents {
  const panel = {
    padding: 1,
    headerHeight: 4,
    background: palette.layer1,
    border: '1px solid transparent',
    boxShadow: shadows.z0,
  };

  return {
    height: {
      sm: 3,
      md: 4,
      lg: 6,
    },
    tooltip: {
      background: palette.layer2,
      text: palette.text.primary,
    },
    menu: {
      background: palette.layer2,
    },
    dropdown: {
      background: palette.layer2,
    },
    scrollbar: {
      background: palette.secondary.main,
    },
    card: {
      background: palette.layer2,
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
    pageToolbar: {
      background: palette.layer0,
      boxShadow: 'none',
      border: 'none',
    },
    dashboard: {
      background: palette.layer0,
      padding: 1,
    },
  };
}
