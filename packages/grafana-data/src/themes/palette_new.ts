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

  // Every hue family below shares one OKLCH lightness ramp, at a constant hue per family.
  // The ramp is spaced to satisfy text contrast against the lowest-contrast surface each
  // mode uses, so these shades carry guarantees rather than just a look:
  //   700 >= 4.5:1 on neutral150 (light body text)
  //   300 >= 4.5:1 on ink750 (dark body text)
  //   500 >= 3.0:1 on neutral150 AND ink750 — a two-sided window, for large text and
  //     non-text UI in either mode
  // 500 is the binding shade: teal500 sits only +0.14 over 3.0:1 on neutral150, so changing
  // any family's hue or chroma needs re-checking there first. 600 is deliberately NOT a
  // light-mode body-text shade — it reaches only 4.32:1 at worst. Use 700.

  // Red. Status: error, critical (OKLCH hue ~25, constant across the scale)
  // Peak chroma is higher than the other scales, so shades 50-400 are pinned to the sRGB
  // gamut edge rather than following the shared chroma curve.
  red50: '#fff2f0',
  red100: '#ffdfdc',
  red200: '#ffc3bd',
  red300: '#fd9990',
  red400: '#f76a63',
  red500: '#ee2732',
  red600: '#c72129',
  red700: '#9e2124',
  red800: '#77201f',
  red900: '#551716',
  red950: '#360e0d',

  // brand (OKLCH hue ~51, constant across the scale)
  orange50: '#fdf3ed',
  orange100: '#fde2d3',
  orange200: '#fcc8aa',
  orange300: '#f6a16e',
  orange400: '#e57f39',
  orange500: '#cb6200',
  orange600: '#aa5000',
  orange700: '#884109',
  orange800: '#663410',
  orange900: '#49240c',
  orange950: '#2e1607',

  // Yellow-orange. Status: warning, pending
  amber50: '#faf5ea',
  amber100: '#f4e6ca',
  amber200: '#edd198',
  amber300: '#deb24a',
  amber400: '#c69500',
  amber500: '#aa7a00',
  amber600: '#8f6400',
  amber700: '#725100',
  amber800: '#563f00',
  amber900: '#3d2d03',
  amber950: '#251c05',

  // Yellow-green. Categorisation
  lime50: '#f2f7ed',
  lime100: '#e0edd5',
  lime200: '#c5deae',
  lime300: '#9ac980',
  lime400: '#74b05e',
  lime500: '#519741',
  lime600: '#3f7e39',
  lime700: '#2f6632',
  lime800: '#294d2b',
  lime900: '#1e361f',
  lime950: '#102211',

  // Green. Status: success, healthy
  sage50: '#f0f7f3',
  sage100: '#daede2',
  sage200: '#b9dfc9',
  sage300: '#8bc9a7',
  sage400: '#61b188',
  sage500: '#46966e',
  sage600: '#367d5a',
  sage700: '#31644a',
  sage800: '#2a4c3a',
  sage900: '#1d3629',
  sage950: '#102118',

  // Blue-green. Categorisation
  teal50: '#edf8f6',
  teal100: '#d3efea',
  teal200: '#a8e2d9',
  teal300: '#70ccc0',
  teal400: '#46b2a6',
  teal500: '#20978b',
  teal600: '#147e74',
  teal700: '#1c645c',
  teal800: '#124e47',
  teal900: '#143632',
  teal950: '#0b2220',

  // Light blue. Status: info
  sky50: '#edf7fc',
  sky100: '#d5ecf8',
  sky200: '#a9ddf7',
  sky300: '#70c5ec',
  sky400: '#3aabd9',
  sky500: '#008fbf',
  sky600: '#00789f',
  sky700: '#066080',
  sky800: '#0d4a61',
  sky900: '#0f3444',
  sky950: '#05202c',

  // Blue. Categorisation
  blue50: '#f0f5fd',
  blue100: '#dbe9ff',
  blue200: '#bad6ff',
  blue300: '#90b9ff',
  blue400: '#689df4',
  blue500: '#4b81dc',
  blue600: '#3d6cb8',
  blue700: '#315695',
  blue800: '#29426e',
  blue900: '#1c304e',
  blue950: '#121d30',

  // Purple. Categorisation
  violet50: '#f5f4fd',
  violet100: '#e7e4fe',
  violet200: '#d3cdff',
  violet300: '#b7acfb',
  violet400: '#9d8dee',
  violet500: '#8470d6',
  violet600: '#6d5db2',
  violet700: '#584d8b',
  violet800: '#433b6b',
  violet900: '#302a4c',
  violet950: '#1d192e',

  // Pink-purple. Categorisation
  lavender50: '#f8f3fb',
  lavender100: '#eee3f7',
  lavender200: '#e0caf2',
  lavender300: '#cca7e9',
  lavender400: '#b488d5',
  lavender500: '#9b6bbd',
  lavender600: '#815a9c',
  lavender700: '#67497d',
  lavender800: '#4e385f',
  lavender900: '#372842',
  lavender950: '#23182b',

  // Pink-red. Categorisation
  rose50: '#fcf2f6',
  rose100: '#fbdfeb',
  rose200: '#f9c2db',
  rose300: '#f398c3',
  rose400: '#e173ab',
  rose500: '#c75491',
  rose600: '#a64578',
  rose700: '#833a60',
  rose800: '#623049',
  rose900: '#462234',
  rose950: '#2b1520',
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
