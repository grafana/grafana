import { mergeWith } from 'lodash';
import * as z from 'zod';

import { type ThemeColors } from './createColors';
import type { Radii } from './createShape';
import type { ThemeSpacingTokens } from './createSpacing';
import { resolvePaletteRefs } from './palette_new';
import { type DeepRequired } from './types';

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
    /** Applies to normal buttons, inputs, radio buttons, etc */
    height: z.object({
      sm: z.number().optional(),
      md: z.number().optional(),
      lg: z.number().optional(),
    }),
    input: z.object({
      background: z.string().optional(),
      borderColor: z.string().optional(),
      borderHover: z.string().optional(),
      text: z.string().optional(),
    }),
    tooltip: z.object({
      text: z.string().optional(),
      background: z.string().optional(),
    }),
    panel: z.object({
      padding: z.number().optional(),
      headerHeight: z.number().optional(),
      borderColor: z.string().optional(),
      boxShadow: z.string().optional(),
      background: z.string().optional(),
      contentBackground: z.string().optional(),
      contentBorderColor: z.string().optional(),
    }),
    dropdown: z.object({
      background: z.string().optional(),
    }),
    overlay: z.object({
      background: z.string().optional(),
    }),
    dashboard: z.object({
      background: z.string().optional(),
      padding: z.number().optional(),
    }),
    drawer: z.object({
      padding: z.number().optional(),
    }),
    textHighlight: z.object({
      background: z.string().optional(),
      text: z.string().optional(),
    }),
    sidemenu: z.object({
      width: z.number().optional(),
    }),
    horizontalDrawer: z.object({
      defaultHeight: z.number().optional(),
    }),
    table: z.object({
      rowHoverBackground: z.string().optional(),
      rowSelected: z.string().optional(),
    }),
    menu: z.object({
      borderRadius: z.enum(['default', 'md', 'sm', 'lg', 'pill', 'circle']).optional(),
      padding: z.number().optional(),
    }),
    tag: z.object({
      colors: z.array(z.object({ background: z.string(), text: z.string() })).optional(),
    }),
  })
  .partial();

/** @beta */
type ThemeComponentsInput = z.infer<typeof ThemeComponentsInputSchema>;

// The menu and tag props are overridden to preserve types that zod inference can't reproduce
/** @beta */
export type ThemeComponents = DeepRequired<Omit<z.infer<typeof ThemeComponentsInputSchema>, 'menu' | 'tag'>> & {
  menu: MenuComponentTokens;
  tag: {
    colors: readonly TagColors[];
  };
};

export function createComponents(colors: ThemeColors, componentsInput: ThemeComponentsInput = {}): ThemeComponents {
  const resolvedInputs = resolvePaletteRefs(componentsInput);

  const defaults: ThemeComponents = {
    height: {
      sm: 3,
      md: 4,
      lg: 6,
    },
    input: {
      borderColor: colors.border.medium,
      borderHover: colors.border.strong,
      text: colors.text.primary,
      background: colors.mode === 'dark' ? colors.background.canvas : colors.background.primary,
    },
    panel: {
      padding: 1,
      headerHeight: 5,
      background: colors.background.primary,
      borderColor: colors.border.weak,
      boxShadow: 'none',
      contentBackground: colors.background.secondary,
      contentBorderColor: colors.border.medium,
    },
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
    menu: {
      borderRadius: 'lg',
      padding: 0.5,
    },
    tag: {
      colors: DEFAULT_TAG_COLORS,
    },
  };

  // deep-merge caller overrides on top of the defaults
  // arrays (e.g. tag.colors) are replaced wholesale rather than merged by index
  return mergeWith({}, defaults, resolvedInputs, (_, inputValue) =>
    Array.isArray(inputValue) ? inputValue : undefined
  );
}
