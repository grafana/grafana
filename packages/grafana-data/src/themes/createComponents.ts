import { mergeWith } from 'lodash';
import * as z from 'zod/mini';

import { onBackground } from './colorManipulator';
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

const ThemeTableColorsInputSchema = z.object({
  rowHoverBackground: z.optional(z.string().check(z.describe('Opaque background for a hovered, unselected row.'))),
  rowSelected: z.optional(
    z
      .string()
      .check(
        z.describe(
          'Deprecated: use components.table.rowSelectedBackground. This property will be removed in Grafana 14.'
        )
      )
  ),
  headerBackground: z.optional(z.string().check(z.describe('Opaque header surface, distinct from body rows.'))),
  border: z.optional(z.string().check(z.describe('Opaque body and footer dividers.'))),
  rowStripedBackground: z.optional(
    z
      .string()
      .check(
        z.describe('Opaque background for alternating body rows; excludes headers, footers and expansion containers.')
      )
  ),
  rowSelectedBackground: z.optional(z.string().check(z.describe('Opaque background for a selected row.'))),
});

type InferredThemeTableColors = Required<z.infer<typeof ThemeTableColorsInputSchema>>;

type ThemeTableColors = Omit<InferredThemeTableColors, 'rowSelected'> & {
  /** @deprecated Use `theme.components.table.rowSelectedBackground`. This property will be removed in Grafana 14. */
  rowSelected: string;
};

const badgeColorTokens = z.object({
  text: z.optional(z.string()),
  background: z.optional(z.string()),
  border: z.optional(z.string()),
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
export const ThemeComponentsInputSchema = z.partial(
  z.object({
    /** Applies to normal buttons, inputs, radio buttons, etc */
    height: z.object({
      sm: z.optional(z.number()),
      md: z.optional(z.number()),
      lg: z.optional(z.number()),
    }),
    input: z.object({
      background: z.optional(z.string()),
      borderColor: z.optional(z.string()),
      borderHover: z.optional(z.string()),
      text: z.optional(z.string()),
    }),
    codeEditor: z.object({
      keyword: z.optional(z.string()),
      controlKeyword: z.optional(z.string()),
      variable: z.optional(z.string()),
      type: z.optional(z.string()),
      function: z.optional(z.string()),
      number: z.optional(z.string()),
      string: z.optional(z.string()),
      operator: z.optional(z.string()),
      regexp: z.optional(z.string()),
      comment: z.optional(z.string()),
      heading: z.optional(z.string()),
      link: z.optional(z.string()),
      invalid: z.optional(z.string()),
    }),
    card: z.object({
      background: z.optional(z.string()),
      borderColor: z.optional(z.string()),
    }),
    checkbox: z.object({
      activeBackground: z.optional(z.string()),
      activeBackgroundHover: z.optional(z.string()),
    }),
    switch: z.object({
      activeBackground: z.optional(z.string()),
      activeBackgroundHover: z.optional(z.string()),
    }),
    tooltip: z.object({
      text: z.optional(z.string()),
      background: z.optional(z.string()),
      borderColor: z.optional(z.string()),
    }),
    panel: z.object({
      padding: z.optional(z.number()),
      headerHeight: z.optional(z.number()),
      borderColor: z.optional(z.string()),
      boxShadow: z.optional(z.string()),
      background: z.optional(z.string()),
    }),
    dropdown: z.object({
      background: z.optional(z.string()),
      borderColor: z.optional(z.string()),
    }),
    modal: z.object({
      background: z.optional(z.string()),
      borderColor: z.optional(z.string()),
    }),
    overlay: z.object({
      background: z.optional(z.string()),
    }),
    dashboard: z.object({
      background: z.optional(z.string()),
      padding: z.optional(z.number()),
    }),
    drawer: z.object({
      background: z.optional(z.string()),
      borderColor: z.optional(z.string()),
      padding: z.optional(z.number()),
    }),
    textHighlight: z.object({
      background: z.optional(z.string()),
      text: z.optional(z.string()),
    }),
    sidemenu: z.object({
      width: z.optional(z.number()),
    }),
    horizontalDrawer: z.object({
      defaultHeight: z.optional(z.number()),
    }),
    table: ThemeTableColorsInputSchema,
    menu: z.object({
      borderRadius: z.optional(z.enum(['default', 'md', 'sm', 'lg', 'pill', 'circle'])),
      padding: z.optional(z.number()),
    }),
    tag: z.object({
      colors: z.optional(z.array(z.object({ background: z.string(), text: z.string() }))),
    }),
    home: z.object({
      background: z.optional(
        z.object({
          fade: z.optional(z.string()),
          highlight: z.optional(z.string()),
          right: z.optional(z.string()),
          left: z.optional(z.string()),
        })
      ),
    }),
    // keyed by BadgeColor ('brand' is handled separately)
    badge: z.object({
      blue: z.optional(badgeColorTokens),
      red: z.optional(badgeColorTokens),
      green: z.optional(badgeColorTokens),
      orange: z.optional(badgeColorTokens),
      purple: z.optional(badgeColorTokens),
      darkgrey: z.optional(badgeColorTokens),
      brand: z.optional(badgeColorTokens),
    }),
  })
);

/** @beta */
type ThemeComponentsInput = z.infer<typeof ThemeComponentsInputSchema>;

// The menu is overridden to preserve types that zod inference can't reproduce
/** @beta */
type InferredThemeComponents = DeepRequired<z.infer<typeof ThemeComponentsInputSchema>>;

export type ThemeComponents = Omit<InferredThemeComponents, 'menu' | 'table'> & {
  menu: MenuComponentTokens;
  table: ThemeTableColors;
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
    table: createTableColors(colors),
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
    badge: getBadgeColorToken(colors),
  };

  // deep-merge caller overrides on top of the defaults
  // arrays (e.g. tag.colors) are replaced wholesale rather than merged by index
  return mergeWith({}, defaults, resolvedInputs, (_, inputValue) =>
    Array.isArray(inputValue) ? inputValue : undefined
  );
}
const getBadgeColor = (
  sourceColor: string,
  mode: ThemeColors['mode']
): ThemeComponents['badge'][keyof ThemeComponents['badge']] => {
  const BADGE_TEXT_ADJUSTMENT = mode === 'dark' ? 15 : -25;
  const background = `hsl(from ${sourceColor} h s l / 0.15)`;
  const border = `hsl(from ${sourceColor} h s l / 0.25)`;
  const text = `hsl(from ${sourceColor} h s calc(l + ${BADGE_TEXT_ADJUSTMENT}))`;

  return { background, border, text };
};

const getBadgeColorToken = (colors: ThemeColors): ThemeComponents['badge'] => {
  const mode = colors.mode;

  const BADGE_RED = mode === 'dark' ? '#F2495C' : '#E02F44';
  const BADGE_ORANGE = mode === 'dark' ? '#FF9830' : '#FF780A';
  const BADGE_GREEN = mode === 'dark' ? '#73BF69' : '#56A64B';
  const BADGE_BLUE = mode === 'dark' ? '#5794F2' : '#3274D9';
  const BADGE_PURPLE = mode === 'dark' ? '#B877D9' : '#A352CC';
  const BADGE_DARKGREY = '#a9a9a9';

  return {
    red: getBadgeColor(BADGE_RED, mode),
    orange: getBadgeColor(BADGE_ORANGE, mode),
    green: getBadgeColor(BADGE_GREEN, mode),
    blue: getBadgeColor(BADGE_BLUE, mode),
    purple: getBadgeColor(BADGE_PURPLE, mode),
    darkgrey: getBadgeColor(BADGE_DARKGREY, mode),
    brand: {
      background: colors.gradients.brandHorizontal,
      border: 'transparent',
      text: colors.primary.contrastText,
    },
  };
};

function createTableColors(colors: ThemeColors): ThemeTableColors {
  const background = colors.background.primary;
  const headerBackground = onBackground(colors.secondary.main, background).toHexString();
  const rowSelectedBackground =
    colors.mode === 'dark'
      ? onBackground(colors.warning.main, background).darken(37).toHexString()
      : onBackground(colors.warning.main, background).lighten(25).toHexString();
  const rowHoverOverlay = colors.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
  const rowHoverBackground = onBackground(rowHoverOverlay, background).toHexString();

  return {
    rowHoverBackground,
    rowSelected: colors.action.selected,
    headerBackground,
    border: onBackground(colors.border.weak, background).toHexString(),
    rowStripedBackground: colors.background.secondary,
    rowSelectedBackground,
  };
}
