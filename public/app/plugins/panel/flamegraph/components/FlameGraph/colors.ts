import color from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';

import murmurhash3_32_gc from './murmur3';

// Colors taken from pyroscope, they should be from Grafana originally, but I didn't find from where exactly.
const packageColors = [
  color({ h: 24, s: 69, l: 60 }),
  color({ h: 34, s: 65, l: 65 }),
  color({ h: 194, s: 52, l: 61 }),
  color({ h: 163, s: 45, l: 55 }),
  color({ h: 211, s: 48, l: 60 }),
  color({ h: 246, s: 40, l: 65 }),
  color({ h: 305, s: 63, l: 79 }),
  color({ h: 47, s: 100, l: 73 }),

  color({ r: 183, g: 219, b: 171 }),
  color({ r: 244, g: 213, b: 152 }),
  color({ r: 78, g: 146, b: 249 }),
  color({ r: 249, g: 186, b: 143 }),
  color({ r: 242, g: 145, b: 145 }),
  color({ r: 130, g: 181, b: 216 }),
  color({ r: 229, g: 168, b: 226 }),
  color({ r: 174, g: 162, b: 224 }),
  color({ r: 154, g: 196, b: 138 }),
  color({ r: 242, g: 201, b: 109 }),
  color({ r: 101, g: 197, b: 219 }),
  color({ r: 249, g: 147, b: 78 }),
  color({ r: 234, g: 100, b: 96 }),
  color({ r: 81, g: 149, b: 206 }),
  color({ r: 214, g: 131, b: 206 }),
  color({ r: 128, g: 110, b: 183 }),
];

const byValueMinColor = getBarColorByValue(1, 100, 0, 1);
const byValueMaxColor = getBarColorByValue(100, 100, 0, 1);
export const byValueGradient = `linear-gradient(90deg, ${byValueMinColor} 0%, ${byValueMaxColor} 100%)`;

// Handpicked some vaguely rainbow-ish colors
export const byPackageGradient = `linear-gradient(90deg, ${packageColors[0]} 0%, ${packageColors[2]} 30%, ${packageColors[6]} 50%, ${packageColors[7]} 70%, ${packageColors[8]} 100%)`;

export function getBarColorByValue(value: number, totalTicks: number, rangeMin: number, rangeMax: number) {
  //  / (rangeMax - rangeMin) here so when you click a bar it will adjust the top (clicked)bar to the most 'intense' color
  const intensity = Math.min(1, value / totalTicks / (rangeMax - rangeMin));
  const h = 50 - 50 * intensity;
  const l = 65 + 7 * intensity;

  return color({ h, s: 100, l });
}

export function getBarColorByPackage(label: string, theme: GrafanaTheme2) {
  const packageName = getPackageName(label);
  // TODO: similar thing happens in trace view with selecting colors of the spans, so maybe this could be unified.
  const hash = murmurhash3_32_gc(packageName || '', 0);
  const colorIndex = hash % packageColors.length;
  let packageColor = packageColors[colorIndex];
  if (theme.isLight) {
    packageColor = packageColor.clone().brighten(15);
  }
  return packageColor;
}

// const getColors = memoizeOne((theme) => getFilteredColors(colors, theme));

// Different regexes to get the package name and function name from the label. We may at some point get an info about
// the language from the backend and use the right regex but right now we just try all of them from most to least
// specific.
const matchers = [
  ['phpspy', /^(?<packageName>(.*\/)*)(?<filename>.*\.php+)(?<line_info>.*)$/],
  ['pyspy', /^(?<packageName>(.*\/)*)(?<filename>.*\.py+)(?<line_info>.*)$/],
  ['rbspy', /^(?<packageName>(.*\/)*)(?<filename>.*\.rb+)(?<line_info>.*)$/],
  [
    'nodespy',
    /^(\.\/node_modules\/)?(?<packageName>[^/]*)(?<filename>.*\.?(jsx?|tsx?)?):(?<functionName>.*):(?<line_info>.*)$/,
  ],
  ['gospy', /^(?<packageName>.*?\/.*?\.|.*?\.|.+)(?<functionName>.*)$/], // also 'scrape'
  ['javaspy', /^(?<packageName>.+\/)(?<filename>.+\.)(?<functionName>.+)$/],
  ['dotnetspy', /^(?<packageName>.+)\.(.+)\.(.+)\(.*\)$/],
  ['tracing', /^(?<packageName>.+?):.*$/],
  ['pyroscope-rs', /^(?<packageName>[^::]+)/],
  ['ebpfspy', /^(?<packageName>.+)$/],
  ['unknown', /^(?<packageName>.+)$/],
];

// Get the package name from the symbol. Try matchers from the list and return first one that matches.
function getPackageName(name: string): string | undefined {
  for (const [_, matcher] of matchers) {
    const match = name.match(matcher);
    if (match) {
      return match.groups?.packageName || '';
    }
  }
  return undefined;
}
