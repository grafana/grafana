import * as z from 'zod';

import { type ThemeColors } from './createColors';
import { type ThemeShadows } from './createShadows';
import type { Radii } from './createShape';
import type { ThemeSpacingTokens } from './createSpacing';
import { resolvePaletteRefs } from './palette_new';

interface MenuComponentTokens {
  borderRadius: keyof Radii;
  padding: ThemeSpacingTokens;
}

interface TagColors {
  background: string;
  text: string;
}

const DEFAULT_TAG_TEXT_COLOR = '#f7f8fa';
/**
 * Default tag colours, used when a theme does not provide its own.
 */
export const DEFAULT_TAG_COLORS: readonly TagColors[] = [
  { background: '#D32D20', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#1E72B8', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#B240A2', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#705DA0', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#466803', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#497A3C', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#3D71AA', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#B15415', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#890F02', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#6E6E6E', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#0A437C', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#6D1F62', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#584477', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#4C7A3F', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#2F4F4F', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#BF1B00', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#7662B1', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#8A2EB8', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#517A00', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#000000', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#3F6833', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#2F575E', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#99440A', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#AE561A', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#0E4AB4', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#58140C', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#052B51', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#511749', text: DEFAULT_TAG_TEXT_COLOR },
  { background: '#3F2B5B', text: DEFAULT_TAG_TEXT_COLOR },
];

/** @beta */
export const ThemeComponentsInputSchema = z
  .object({
    tag: z
      .object({
        colors: z.array(z.object({ background: z.string(), text: z.string() })).optional(),
      })
      .optional(),
  })
  .optional();

/** @beta */
export type ThemeComponentsInput = z.infer<typeof ThemeComponentsInputSchema>;

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
    borderColor: string;
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
    borderColor: string;
    boxShadow: string;
    background: string;
    contentBackground: string;
    contentBorderColor: string;
  };
  dropdown: {
    background: string;
  };
  overlay: {
    background: string;
  };
  dashboard: {
    background: string;
    padding: number;
  };
  drawer: {
    padding: number;
  };
  textHighlight: {
    background: string;
    text: string;
  };
  sidemenu: {
    width: number;
  };
  horizontalDrawer: {
    defaultHeight: number;
  };
  table: {
    rowHoverBackground: string;
    rowSelected: string;
  };
  menu: MenuComponentTokens;
  tag: {
    colors: readonly TagColors[];
  };
}

export function createComponents(
  colors: ThemeColors,
  shadows: ThemeShadows,
  componentsInput: ThemeComponentsInput = {}
): ThemeComponents {
  const resolvedComponents = resolvePaletteRefs(componentsInput);

  const tag = {
    // replace the default array wholesale rather than merging by index
    colors: resolvedComponents.tag?.colors ?? DEFAULT_TAG_COLORS,
  };

  const panel = {
    padding: 1,
    headerHeight: 5,
    background: colors.background.primary,
    borderColor: colors.border.weak,
    boxShadow: 'none',
    contentBackground: colors.background.secondary,
    contentBorderColor: colors.border.medium,
  };

  const input = {
    borderColor: colors.border.medium,
    borderHover: colors.border.strong,
    text: colors.text.primary,
    background: colors.mode === 'dark' ? colors.background.canvas : colors.background.primary,
  };

  const menu: MenuComponentTokens = {
    borderRadius: 'lg',
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
    tag,
  };
}
