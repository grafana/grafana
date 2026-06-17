export const palette = {
  // white/black
  white: '#ffffff',
  black: '#000000',

  // neutrals
  // Warm grey scale for light mode structural colours
  neutral50: '#fafafa',
  neutral100: '#f5f5f4',
  neutral200: '#ebebea',
  neutral300: '#dddcdb',
  neutral400: '#b0afae',
  neutral500: '#878685',
  neutral600: '#6b6a69',
  neutral700: '#4d4c4b',
  neutral800: '#2c2b2a',
  neutral900: '#1c1b1a',
  neutral950: '#121111',
  // Blue-tinted neutral scale for dark mode (OKLCH hue ~255, low chroma)
  ink50: '#eceff2',
  ink100: '#dadee3',
  ink200: '#b9bec6',
  ink300: '#9299a2',
  ink400: '#6b727c',
  ink500: '#4d535b',
  ink600: '#33383f',
  ink700: '#1e2227',
  ink800: '#13161b',
  ink850: '#0e1115',
  ink900: '#0b0d11',
  ink950: '#040608',

  // brand
  orange50: '#fff7ed',
  orange100: '#ffedd5',
  orange200: '#fed7aa',
  orange300: '#fdba74',
  orange400: '#f59e4b',
  orange500: '#ed7d2d',
  orange600: '#d4621b',
  orange700: '#b04a17',
  orange800: '#8e3c17',
  orange900: '#743218',

  // Warm red-orange. Status: error, critical
  coral50: '#fff1f0',
  coral100: '#ffdedb',
  coral200: '#ffc0ba',
  coral300: '#fe9b93',
  coral400: '#f47b74',
  coral500: '#e15955',
  coral600: '#bc4945',
  coral700: '#963d3a',
  coral800: '#70312e',
  coral900: '#512320',
  coral950: '#331513',

  // Warm orange. Categorisation
  peach50: '#fef3ec',
  peach100: '#fbe2d2',
  peach200: '#f9c9a9',
  peach300: '#f5ab77',
  peach400: '#e69052',
  peach500: '#cf752d',
  peach600: '#ac6227',
  peach700: '#884c1e',
  peach800: '#683b18',
  peach900: '#4a2a12',
  peach950: '#2e1a0c',

  // Yellow-orange. Status: warning, pending
  amber50: '#faf5ea',
  amber100: '#f4e6ca',
  amber200: '#edd198',
  amber300: '#e4b750',
  amber400: '#d6a20a',
  amber500: '#be8800',
  amber600: '#a07100',
  amber700: '#7d5a00',
  amber800: '#5e4608',
  amber900: '#43330a',
  amber950: '#2a2009',

  // Yellow-green. Categorisation
  lime50: '#f2f7ed',
  lime100: '#e0edd5',
  lime200: '#c5deae',
  lime300: '#9fce85',
  lime400: '#7ebb68',
  lime500: '#5aa04a',
  lime600: '#44833e',
  lime700: '#326935',
  lime800: '#2b4f2d',
  lime900: '#1f3720',
  lime950: '#102211',

  // Green. Status: success, healthy
  sage50: '#f0f7f3',
  sage100: '#daede2',
  sage200: '#b9dfc9',
  sage300: '#90ceac',
  sage400: '#68b88f',
  sage500: '#4c9c74',
  sage600: '#387f5c',
  sage700: '#31644a',
  sage800: '#294b39',
  sage900: '#1b3427',
  sage950: '#102118',

  // Blue-green. Categorisation
  teal50: '#edf8f6',
  teal100: '#d3efea',
  teal200: '#a8e2d9',
  teal300: '#75d1c5',
  teal400: '#4eb9ad',
  teal500: '#2a9d91',
  teal600: '#167f75',
  teal700: '#1d655d',
  teal800: '#114d46',
  teal900: '#123430',
  teal950: '#0a211f',

  // Light blue. Status: info
  sky50: '#edf7fc',
  sky100: '#d5ecf8',
  sky200: '#a9ddf7',
  sky300: '#72c7ee',
  sky400: '#43b2e1',
  sky500: '#0096c8',
  sky600: '#007ca5',
  sky700: '#0c6383',
  sky800: '#104c63',
  sky900: '#103545',
  sky950: '#07232f',

  // Blue. Categorisation
  blue50: '#f0f5fd',
  blue100: '#dbe9ff',
  blue200: '#bad6ff',
  blue300: '#8eb8fe',
  blue400: '#699ef5',
  blue500: '#4d84df',
  blue600: '#3c6ab6',
  blue700: '#2f5492',
  blue800: '#263f6a',
  blue900: '#1b2e4c',
  blue950: '#121d30',

  // Purple. Categorisation
  violet50: '#f5f4fd',
  violet100: '#e7e4fe',
  violet200: '#d3cdff',
  violet300: '#b9aefd',
  violet400: '#a191f2',
  violet500: '#8673d9',
  violet600: '#6f5fb4',
  violet700: '#584d8c',
  violet800: '#423a6a',
  violet900: '#2e284a',
  violet950: '#1d192e',

  // Pink-purple. Categorisation
  lavender50: '#f8f3fb',
  lavender100: '#eee3f7',
  lavender200: '#e0caf2',
  lavender300: '#cea9eb',
  lavender400: '#bc8fdd',
  lavender500: '#a171c3',
  lavender600: '#855ea1',
  lavender700: '#6a4c80',
  lavender800: '#503a61',
  lavender900: '#382943',
  lavender950: '#251a2d',

  // Pink-red. Categorisation
  rose50: '#fcf2f6',
  rose100: '#fbdfeb',
  rose200: '#f9c2db',
  rose300: '#f59ac5',
  rose400: '#e577af',
  rose500: '#cd5a97',
  rose600: '#a8477a',
  rose700: '#843b61',
  rose800: '#612f48',
  rose900: '#442032',
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
