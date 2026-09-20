import { colorManipulator, createTheme, type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';

/**
 * Builds a Grafana theme from CSS custom properties set on (or inherited by) the
 * element. createTheme already takes validated overrides for colors, typography and
 * shape, so theming a panel to its host needs no change to Grafana.
 *
 * The token names are the MCP Apps host style variables, which hosts such as Claude
 * supply directly (hostContext.styles.variables + applyHostStyleVariables). A plain
 * page sets the same names by hand. CSS custom properties are also the one thing that
 * pierces a shadow boundary, so the element can read them off itself.
 */

type ColorsInput = NonNullable<NewThemeOptions['colors']>;
type TypographyInput = NonNullable<NewThemeOptions['typography']>;

type Vars = (name: string) => string | undefined;

function readVars(el: Element): Vars {
  const computed = getComputedStyle(el);
  return (name: string) => {
    const value = computed.getPropertyValue(name).trim();
    return value === '' ? undefined : value;
  };
}

/**
 * Keeps only the tokens the host actually supplied, so Grafana's own value survives
 * wherever the host is silent.
 */
function present<K extends string>(pairs: Array<readonly [K, string | undefined]>): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const [key, value] of pairs) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function isEmpty(value: object): boolean {
  return Object.keys(value).length === 0;
}

function pxToNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * createTypography throws unless the base font size is an even integer, and host
 * token sets routinely use 13px or 15px. Snap to the nearest even value rather than
 * letting a legitimate host palette blank the panel.
 */
function evenPx(value: string | undefined): number | undefined {
  const parsed = pxToNumber(value);
  return parsed === undefined ? undefined : Math.max(2, Math.round(parsed / 2) * 2);
}

export type ThemeMode = 'dark' | 'light';

/**
 * Mode drives every colour Grafana derives rather than takes from a token, most
 * visibly text.maxContrast. Getting it wrong against the host's palette produces
 * white legend labels on a white panel, so the host's own background token is a more
 * trustworthy signal than the OS preference: a host that hands over a light palette
 * wants a light panel whatever the OS says.
 *
 * Order: explicit attribute, explicit opt-out variable, the host's background token,
 * then the OS preference.
 */
export function resolveThemeMode(el: Element, attr?: string | null): ThemeMode {
  if (attr === 'dark' || attr === 'light') {
    return attr;
  }
  const v = readVars(el);
  const declared = v('--grafana-embed-theme');
  if (declared === 'dark' || declared === 'light') {
    return declared;
  }
  const inferred = modeFromBackground(v('--color-background-primary'));
  if (inferred) {
    return inferred;
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function modeFromBackground(color: string | undefined): ThemeMode | undefined {
  if (!color) {
    return undefined;
  }
  try {
    // Host tokens are arbitrary CSS colour strings; anything unparseable just falls
    // through to the next signal.
    return colorManipulator.getLuminance(color) > 0.3 ? 'light' : 'dark';
  } catch {
    return undefined;
  }
}

/** Semantic roles, paired with the host token family that describes them. */
const SEMANTIC_ROLES = [
  ['error', 'danger'],
  ['success', 'success'],
  ['warning', 'warning'],
  ['info', 'info'],
] as const;

export function themeFromCssVars(el: Element, mode: ThemeMode): GrafanaTheme2 {
  const v = readVars(el);

  const backgroundPrimary = v('--color-background-primary');
  const backgroundSecondary = v('--color-background-secondary');

  // A panel is composited onto the host's own surface, so the host's primary
  // background is the embed's canvas as well as its panel background.
  const background = present([
    ['canvas', backgroundPrimary],
    ['page', backgroundPrimary],
    ['primary', backgroundPrimary],
    ['secondary', backgroundSecondary],
    ['elevated', backgroundSecondary],
  ]);

  const text = present([
    ['primary', v('--color-text-primary')],
    ['secondary', v('--color-text-secondary')],
    ['disabled', v('--color-text-tertiary')],
  ]);

  const border = present([
    ['weak', v('--color-border-primary')],
    ['medium', v('--color-border-secondary')],
    ['strong', v('--color-border-tertiary')],
  ]);

  const colors: ColorsInput = {
    mode,
    ...(isEmpty(background) ? {} : { background }),
    ...(isEmpty(text) ? {} : { text }),
    ...(isEmpty(border) ? {} : { border }),
  };

  for (const [role, token] of SEMANTIC_ROLES) {
    const rich = present([
      ['main', v(`--color-background-${token}`)],
      ['text', v(`--color-text-${token}`)],
    ]);
    if (!isEmpty(rich)) {
      colors[role] = rich;
    }
  }

  const typography: TypographyInput = present([
    ['fontFamily', v('--font-sans')],
    ['fontFamilyMonospace', v('--font-mono')],
  ]);
  const fontSize = evenPx(v('--font-text-md-size'));
  if (fontSize !== undefined) {
    typography.fontSize = fontSize;
  }

  const options: Omit<NewThemeOptions, 'id' | 'name'> = { colors };
  if (!isEmpty(typography)) {
    options.typography = typography;
  }
  const borderRadius = pxToNumber(v('--border-radius-md'));
  if (borderRadius !== undefined) {
    options.shape = { borderRadius };
  }

  // A host's tokens are arbitrary strings from outside Grafana. If any of them make
  // createTheme unhappy, a themed panel is still better than no panel.
  try {
    return createTheme(options);
  } catch (err) {
    console.warn('[grafana-embed] host tokens rejected by createTheme, falling back', err);
    return createTheme({ colors: { mode } });
  }
}
