export const palette = {
  // white/black
  white: '#ffffff',
  black: '#000000',

  // neutrals
  // Warm grey scale for light mode structural colours
  neutral50: '#fafafa',
  neutral100: '#f5f5f4',
  neutral150: '#f0f0ef',
  neutral200: '#ebebea',
  neutral250: '#e4e3e2',
  neutral300: '#dddcdb',
  neutral350: '#c6c5c4',
  neutral400: '#b0afae',
  neutral450: '#9b9a99',
  neutral500: '#878685',
  neutral550: '#797877',
  neutral600: '#6b6a69',
  neutral650: '#5c5b5a',
  neutral700: '#4d4c4b',
  neutral750: '#3c3b3a',
  neutral800: '#2c2b2a',
  neutral850: '#242322',
  neutral900: '#1c1b1a',
  neutral950: '#121111',
  // Blue-tinted neutral scale for dark mode (OKLCH hue ~255, low chroma)
  ink50: '#eceff2',
  ink100: '#dadee3',
  ink150: '#c9ced4',
  ink200: '#b9bec6',
  ink250: '#a5abb4',
  ink300: '#9299a2',
  ink350: '#7e858f',
  ink400: '#6b727c',
  ink450: '#5c626b',
  ink500: '#4d535b',
  ink550: '#40454d',
  ink600: '#33383f',
  ink650: '#282d33',
  ink700: '#202429',
  ink750: '#191d22',
  ink800: '#14171c',
  ink850: '#0e1115',
  ink900: '#090b0f',
  ink950: '#040608',

  // Every hue family below shares one OKLCH lightness ramp — evenly spaced, 0.930 down to
  // 0.217 in steps of 0.0713 — at a constant hue per family. The step size is not a look:
  // it is sized around the five guarantees below.
  //   700 >= 4.5:1 on neutral150  — light body text on the page
  //   300 >= 4.5:1 on ink750      — dark body text on the page
  //   500 >= 3.0:1 on neutral150 AND ink750 — always safe for large text and non-text UI
  //     in either mode, which is why 500 is the one shade with a two-sided bound
  //   ANY two shades of one family SEVEN steps apart >= 4.5:1 — so 50/700, 100/800, 200/900
  //     and 300/950 hold, whichever end the theme uses as the background
  // The seven-step rule is the point of the even spacing: pick any pair that far apart and it
  // is AA for normal text without checking. Worst case is amber 50/700 at 6.28.
  //
  // Both themes are wired to match, so every declared text pairing is exactly seven steps:
  //   light  text 700 on background 50    textEmphasis 800 on backgroundEmphasis 100
  //   dark   text 300 on background 950   textEmphasis 200 on backgroundEmphasis 900
  // `main` is a fill rather than text on a tint, so it stays at 600 light / 400 dark and is
  // not covered by the rule — check it against whatever it actually sits on.
  //
  // Shades 400 and 600 appear in no seven-step pair, so nothing constrains them — they are
  // free to be tuned for looks. Re-check the seven-step pairs and the 500 bound before
  // changing any family's hue or chroma.
  //
  // The scale starts at 0.930 because it was shifted up one slot: shade 50 now holds roughly
  // what 100 used to, retiring a near-white 50 nothing referenced.
  //
  // Chroma peaks at 500 and falls away symmetrically either side, capped to what the sRGB
  // gamut allows at 500 so the peak cannot land on 400 by accident.
  //
  // Orange and amber deliberately break that rule. For warm hues the gamut is widest in the
  // light half, so pinning their peak to 500 made them muddy. They instead take the most
  // chroma available at each lightness — peaking at 400 and 200 respectively — with only
  // shades 50 and 100 held back, since those are background tints rather than fields of
  // colour. Their contrast guarantees are unaffected.
  //
  // Orange and amber also have their own lightness ramps, shifted lighter through the
  // mid-tones so those shades read as the hue rather than as brown or olive. Both are anchored
  // on 50, 500, 700 and 950 with the rest interpolated, and 700 sits exactly on the 50/700
  // boundary — orange 4.502, amber 4.513, as close to 4.5:1 as 8-bit output allows. That is
  // what buys the mid-tones their lightness, so moving 700 down again undoes it.
  //
  // The 4.5:1 limit is set by the family's own 50, not by the page: orange50 has luminance
  // 0.797 against neutral150's 0.871, so the tint is the harder background. Pushing 700 to the
  // page boundary instead (L 0.547 rather than 0.529) would break 50/700.
  //
  // Amber's 500 is held at L 0.635 so it keeps 3:1 against neutral150 (it lands at 3.05).
  //
  // Steps are even across 50-700 (~0.058) and wider from 700 down (~0.10), since 800-900
  // interpolate to a fixed 950. NOTE: lightening 600 dropped white-on-600 to 4.40 for orange
  // and 4.34 for amber — fine for large text, short of AA for normal. The light theme's
  // `accent.main` is orange600 with `contrastText` white, so that button label is AA-large
  // only; point `main` at 700 if it needs full AA.

  // Red. Status: error, critical (OKLCH hue ~25, constant across the scale)
  // Its peak is the highest of any scale, so the light shades still ride the sRGB gamut edge
  // rather than following the shared chroma curve exactly.
  red50: '#ffdfdc',
  red100: '#ffbeb7',
  red200: '#ff9a90',
  red300: '#ff6f68',
  red400: '#f44444',
  red500: '#e00c26',
  red600: '#bb0b1e',
  red700: '#94151d',
  red800: '#6f1818',
  red900: '#4f1212',
  red950: '#320a09',

  // brand (OKLCH hue ~51, constant across the scale)
  orange50: '#ffe1d0',
  orange100: '#ffc8a8',
  orange200: '#ffad7b',
  orange300: '#ff8f45',
  orange400: '#f47600',
  orange500: '#da6900',
  orange600: '#c05c00',
  orange700: '#a74f00',
  orange800: '#7c3900',
  orange900: '#532300',
  orange950: '#2d1000',

  // Yellow-orange. Status: warning, pending
  amber50: '#fce5c0',
  amber100: '#f7ce8a',
  amber200: '#fab300',
  amber300: '#e2a200',
  amber400: '#cb9100',
  amber500: '#b48000',
  amber600: '#9f7100',
  amber700: '#8a6100',
  amber800: '#664700',
  amber900: '#442e00',
  amber950: '#251700',

  // Yellow-green. Categorisation
  lime50: '#e1ecd7',
  lime100: '#c4d9b2',
  lime200: '#a2c78e',
  lime300: '#80b46e',
  lime400: '#60a051',
  lime500: '#418c3a',
  lime600: '#2f7534',
  lime700: '#275e2c',
  lime800: '#224723',
  lime900: '#183218',
  lime950: '#0d1f0f',

  // Green. Status: success, healthy
  sage50: '#dcede3',
  sage100: '#bbd9c8',
  sage200: '#98c7ac',
  sage300: '#76b392',
  sage400: '#569f7a',
  sage500: '#3a8a63',
  sage600: '#2e7353',
  sage700: '#295c42',
  sage800: '#214633',
  sage900: '#173124',
  sage950: '#0d1e15',

  // Blue-green. Categorisation
  teal50: '#d9ede9',
  teal100: '#b4dad4',
  teal200: '#8cc7bf',
  teal300: '#64b4aa',
  teal400: '#3ca095',
  teal500: '#038b80',
  teal600: '#05746a',
  teal700: '#135c53',
  teal800: '#144641',
  teal900: '#0f312e',
  teal950: '#081e1d',

  // Light blue. Status: info
  sky50: '#d8ebf6',
  sky100: '#b3d7e9',
  sky200: '#89c3df',
  sky300: '#61aed2',
  sky400: '#3a99c3',
  sky500: '#0084b0',
  sky600: '#006e91',
  sky700: '#0d5873',
  sky800: '#124357',
  sky900: '#0d2f3d',
  sky950: '#081d26',

  // Blue. Categorisation
  blue50: '#dbe9ff',
  blue100: '#b8d3f8',
  blue200: '#97bbf6',
  blue300: '#76a4ee',
  blue400: '#598de2',
  blue500: '#3f76cf',
  blue600: '#3462ad',
  blue700: '#2c4f89',
  blue800: '#223d66',
  blue900: '#192b48',
  blue950: '#0e1a2d',

  // Purple. Categorisation
  violet50: '#e7e5fd',
  violet100: '#d0caf6',
  violet200: '#b8b0f2',
  violet300: '#a296e9',
  violet400: '#8d7ddc',
  violet500: '#7965ca',
  violet600: '#6454a8',
  violet700: '#4f4485',
  violet800: '#3e3463',
  violet900: '#2c2546',
  violet950: '#1a162c',

  // Pink-purple. Categorisation
  lavender50: '#eee3f7',
  lavender100: '#dbc8eb',
  lavender200: '#c9ace1',
  lavender300: '#b791d4',
  lavender400: '#a478c4',
  lavender500: '#8f60b1',
  lavender600: '#775094',
  lavender700: '#5e4176',
  lavender800: '#483258',
  lavender900: '#33233e',
  lavender950: '#201526',

  // Pink-red. Categorisation
  rose50: '#fbdfeb',
  rose100: '#f2c0d7',
  rose200: '#eb9fc2',
  rose300: '#de80af',
  rose400: '#ce639b',
  rose500: '#ba4986',
  rose600: '#9b3c6f',
  rose700: '#7b3258',
  rose800: '#5d2843',
  rose900: '#421c30',
  rose950: '#29101d',
};

const PALETTE_TOKEN_REGEX = /palette\.(\w+)/g;

function isPaletteKey(key: string): key is keyof typeof palette {
  return key in palette;
}

function resolveRefs(value: string): string {
  return value.replace(PALETTE_TOKEN_REGEX, (match, key) => (isPaletteKey(key) ? palette[key] : match));
}

function walk(node: unknown): unknown {
  if (typeof node === 'string') {
    return resolveRefs(node);
  }
  if (Array.isArray(node)) {
    return node.map(walk);
  }
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
  }
  return node;
}

export function resolvePaletteRefs<T>(input: T): T;
export function resolvePaletteRefs(input: unknown): unknown {
  return walk(input);
}
