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

const badgeColorTokens = z.object({
  text: z.string().optional(),
  background: z.string().optional(),
  border: z.string().optional(),
});

const DEFAULT_TAG_TEXT_COLOR = '#f7f8fa';
/**
 * Default tag colours, used when a theme does not provide its own.
 */
export const DEFAULT_TAG_COLORS: TagColors[] = [
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
    codeEditor: z.object({
      keyword: z.string().optional(),
      controlKeyword: z.string().optional(),
      variable: z.string().optional(),
      type: z.string().optional(),
      function: z.string().optional(),
      number: z.string().optional(),
      string: z.string().optional(),
      operator: z.string().optional(),
      regexp: z.string().optional(),
      comment: z.string().optional(),
      heading: z.string().optional(),
      link: z.string().optional(),
      invalid: z.string().optional(),
    }),
    card: z.object({
      background: z.string().optional(),
      borderColor: z.string().optional(),
    }),
    checkbox: z.object({
      activeBackground: z.string().optional(),
      activeBackgroundHover: z.string().optional(),
    }),
    switch: z.object({
      activeBackground: z.string().optional(),
      activeBackgroundHover: z.string().optional(),
    }),
    tooltip: z.object({
      text: z.string().optional(),
      background: z.string().optional(),
      borderColor: z.string().optional(),
    }),
    panel: z.object({
      padding: z.number().optional(),
      headerHeight: z.number().optional(),
      borderColor: z.string().optional(),
      boxShadow: z.string().optional(),
      background: z.string().optional(),
    }),
    dropdown: z.object({
      background: z.string().optional(),
      borderColor: z.string().optional(),
    }),
    modal: z.object({
      background: z.string().optional(),
      borderColor: z.string().optional(),
    }),
    overlay: z.object({
      background: z.string().optional(),
    }),
    dashboard: z.object({
      background: z.string().optional(),
      padding: z.number().optional(),
    }),
    drawer: z.object({
      background: z.string().optional(),
      borderColor: z.string().optional(),
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
    home: z.object({
      background: z
        .object({
          fade: z.string().optional(),
          highlight: z.string().optional(),
          right: z.string().optional(),
          left: z.string().optional(),
        })
        .optional(),
    }),
    badge: z.object({
      blue: badgeColorTokens.optional(),
      red: badgeColorTokens.optional(),
      green: badgeColorTokens.optional(),
      orange: badgeColorTokens.optional(),
      purple: badgeColorTokens.optional(),
      darkgrey: badgeColorTokens.optional(),
      brand: badgeColorTokens.optional(),
    }),
  })
  .partial();

/** @beta */
type ThemeComponentsInput = z.infer<typeof ThemeComponentsInputSchema>;

// The menu props are overridden to preserve types that zod inference can't reproduce
/** @beta */
export type ThemeComponents = DeepRequired<Omit<z.infer<typeof ThemeComponentsInputSchema>, 'menu'>> & {
  menu: MenuComponentTokens;
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
    codeEditor: {
      keyword: colors.primary.text,
      controlKeyword: colors.tertiary.text,
      variable: colors.text.primary,
      type: colors.tertiary.text,
      function: colors.primary.text,
      number: colors.warning.text,
      string: colors.success.text,
      operator: colors.text.secondary,
      regexp: colors.warning.text,
      comment: colors.text.secondary,
      heading: colors.primary.text,
      link: colors.text.link,
      invalid: colors.error.text,
    },
    card: {
      background: colors.background.secondary,
      borderColor: 'transparent',
    },
    checkbox: {
      activeBackground: colors.accent.main,
      activeBackgroundHover: colors.accent.shade,
    },
    switch: {
      activeBackground: colors.accent.main,
      activeBackgroundHover: colors.accent.shade,
    },
    panel: {
      padding: 1,
      headerHeight: 5,
      background: colors.background.primary,
      borderColor: colors.border.weak,
      boxShadow: 'none',
    },
    dropdown: {
      background: colors.background.elevated,
      borderColor: 'transparent',
    },
    tooltip: {
      background: colors.background.elevated,
      borderColor: 'transparent',
      text: colors.text.primary,
    },
    dashboard: {
      background: colors.background.canvas,
      padding: 1,
    },
    drawer: {
      background: colors.background.primary,
      borderColor: 'transparent',
      padding: 2,
    },
    modal: {
      background: colors.background.primary,
      borderColor: colors.border.weak,
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
    home: {
      background: {
        fade:
          colors.mode === 'dark'
            ? 'hsl(from #3a364c h calc(s * 1.5) calc(l * 1.1))'
            : 'hsl(from #dedfee h calc(s * 1.05) calc(l * 0.9))',
        highlight: 'transparent',
        right:
          colors.mode === 'dark'
            ? 'hsl(from #722323 h calc(s * 1.1) calc(l * 0.9) / 80%)'
            : 'hsl(from #ff9a9a h s l / 80%)',
        left:
          colors.mode === 'dark'
            ? 'hsl(from #1b416d h calc(s * 0.9) calc(l * 0.9) / 60%)'
            : 'hsl(from #a6e3df h s l / 60%)',
      },
    },
    badge: getBadgeColorTokens(colors),
  };

  // deep-merge caller overrides on top of the defaults
  // arrays (e.g. tag.colors) are replaced wholesale rather than merged by index
  return mergeWith({}, defaults, resolvedInputs, (_, inputValue) =>
    Array.isArray(inputValue) ? inputValue : undefined
  );
}

function getBadgeColorTokens(colors: ThemeColors): ThemeComponents['badge'] {
  const mode = colors.mode;
  const BADGE_RED = mode === 'dark' ? '#F2495C' : '#E02F44';
  const BADGE_ORANGE = mode === 'dark' ? '#FF9830' : '#FF780A';
  const BADGE_GREEN = mode === 'dark' ? '#73BF69' : '#56A64B';
  const BADGE_BLUE = mode === 'dark' ? '#5794F2' : '#3274D9';
  const BADGE_PURPLE = mode === 'dark' ? '#B877D9' : '#A352CC';
  const BADGE_DARKGREY = '#a9a9a9';

  return {
    red: getBadgeTokens(BADGE_RED, mode),
    orange: getBadgeTokens(BADGE_ORANGE, mode),
    green: getBadgeTokens(BADGE_GREEN, mode),
    blue: getBadgeTokens(BADGE_BLUE, mode),
    purple: getBadgeTokens(BADGE_PURPLE, mode),
    darkgrey: getBadgeTokens(BADGE_DARKGREY, mode),
    brand: {
      background: colors.gradients.brandHorizontal,
      border: 'transparent',
      text: colors.primary.contrastText,
    },
  };
}

function getBadgeTokens(
  color: string,
  mode: ThemeColors['mode']
): ThemeComponents['badge'][keyof ThemeComponents['badge']] {
  const BADGE_TEXT_ADJUSTMENT = mode === 'dark' ? 15 : -25;

  return {
    background: `hsla(from ${color} h s l / 0.15)`,
    border: `hsla(from ${color} h s l / 0.25)`,
    text: `hsl(from ${color} h s calc(l + ${BADGE_TEXT_ADJUSTMENT}))`,
  };
}
