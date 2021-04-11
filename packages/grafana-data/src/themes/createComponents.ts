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
}

export function createComponents(palette: ThemePalette, shadows: ThemeShadows): ThemeComponents {
  return {
    height: {
      sm: 3,
      md: 4,
      lg: 6,
    },
    tooltip: {
      background: palette.layer2,
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
            border: 'rgba(218,224,254,0.2)',
            text: palette.text.primary,
          }
        : {
            background: palette.layer1,
            border: 'rgba(0,2,78,0.25)',
            text: palette.text.primary,
          },
    panel: {
      padding: 1,
      headerHeight: 4,
      background: palette.layer1,
      border: '1px solid transparent',
      boxShadow: shadows.z0,
    },
    dashboard: {
      background: palette.layer0,
      padding: 1,
    },
  };
}
