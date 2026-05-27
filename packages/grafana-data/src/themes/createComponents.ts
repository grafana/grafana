import { type ThemeShadows } from './createShadows';
import { type ThemeColors } from './types/color.mts';
import { type MenuComponentTokens, type ThemeComponents } from './types/components.mts';

export function createComponents(colors: ThemeColors, shadows: ThemeShadows): ThemeComponents {
  const panel = {
    padding: 1,
    headerHeight: 5,
    background: colors.background.primary,
    borderColor: colors.border.weak,
    boxShadow: 'none',
  };

  const input = {
    borderColor: colors.border.medium,
    borderHover: colors.border.strong,
    text: colors.text.primary,
    background: colors.mode === 'dark' ? colors.background.canvas : colors.background.primary,
  };

  const menu: MenuComponentTokens = {
    borderRadius: 'default',
    padding: 0.5,
  };

  return {
    height: {
      sm: 3,
      md: 4,
      lg: 6,
    },
    input,
    panel,
    dropdown: {
      background: colors.background.elevated,
    },
    tooltip: {
      background: colors.background.elevated,
      text: colors.text.primary,
    },
    dashboard: {
      background: colors.background.canvas,
      padding: 1,
    },
    drawer: {
      padding: 2,
    },
    overlay: {
      background: colors.mode === 'dark' ? 'rgba(63, 62, 62, 0.5)' : 'rgba(208, 209, 211, 0.5)',
    },
    sidemenu: {
      width: 57,
    },
    // @ts-expect-error (added here to not crash plugins that might use it)
    menuTabs: {
      height: 5,
    },
    textHighlight: {
      text: colors.warning.contrastText,
      background: colors.warning.main,
    },
    horizontalDrawer: {
      defaultHeight: 400,
    },
    table: {
      rowHoverBackground: colors.action.hover,
      rowSelected: colors.action.selected,
    },
    menu,
  };
}
