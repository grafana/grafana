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

  // Every hue family below is sized around the five guarantees below.
  //   700 >= 4.5:1 on neutral150  — light body text on the page
  //   300 >= 4.5:1 on ink750      — dark body text on the page
  //   500 >= 3.0:1 on neutral150 AND ink750 — always safe for large text and non-text UI
  //     in either mode, which is why 500 is the one shade with a two-sided bound
  //   ANY two shades of one family SEVEN steps apart >= 4.5:1 — so 50/700, 100/800, 200/900
  //     and 300/950 hold, whichever end the theme uses as the background

  // Red. Status: error, critical
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

  // Orange. Brand
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
