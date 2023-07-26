// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import memoizeOne from 'memoize-one';
import tinycolor from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';
import { colors } from '@grafana/ui';

// TS needs the precise return type
function strToRgb(s: string): [number, number, number] {
  if (s.length !== 7) {
    return [0, 0, 0];
  }
  const r = s.slice(1, 3);
  const g = s.slice(3, 5);
  const b = s.slice(5);
  return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)];
}

class ColorGenerator {
  colorsHex: string[];
  colorsRgb: Array<[number, number, number]>;
  cache: Map<string, number>;

  constructor(colorsHex: string[], theme: GrafanaTheme2) {
    const filteredColors = getFilteredColors(colorsHex, theme);
    this.colorsHex = filteredColors;
    this.colorsRgb = filteredColors.map(strToRgb);
    this.cache = new Map();
  }

  _getColorIndex(key: string): number {
    let i = this.cache.get(key);
    if (i == null) {
      const hash = this.hashCode(key.toLowerCase());
      i = Math.abs(hash % this.colorsHex.length);

      const prevCacheItem = Array.from(this.cache).pop();
      if (prevCacheItem && prevCacheItem[1]) {
        // disallow a color that is the same as the previous color
        if (prevCacheItem[1] === i) {
          i = this.getNextIndex(i);
        }

        // disallow a color that looks very similar to the previous color
        const prevColor = this.colorsHex[prevCacheItem[1]];
        if (tinycolor.readability(prevColor, this.colorsHex[i]) < 1.5) {
          let newIndex = i;
          for (let j = 0; j < this.colorsHex.length; j++) {
            newIndex = this.getNextIndex(newIndex);

            if (tinycolor.readability(prevColor, this.colorsHex[newIndex]) > 1.5) {
              i = newIndex;
              break;
            }
          }
        }
      }

      this.cache.set(key, i);
    }
    return i;
  }

  getNextIndex(i: number) {
    // get next index or go back to 0
    return i + 1 < this.colorsHex.length ? i + 1 : 0;
  }

  hashCode(key: string) {
    let hash = 0,
      i,
      chr;
    for (i = 0; i < key.length; i++) {
      chr = key.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
    }
    return hash;
  }

  /**
   * Will assign a color to an arbitrary key.
   * If the key has been used already, it will
   * use the same color.
   */
  getColorByKey(key: string) {
    const i = this._getColorIndex(key);
    return this.colorsHex[i];
  }

  /**
   * Retrieve the RGB values associated with a key. Adds the key and associates
   * it with a color if the key is not recognized.
   * @returns {number[]} An array of three ints [0, 255] representing a color.
   */
  getRgbColorByKey(key: string): [number, number, number] {
    const i = this._getColorIndex(key);
    return this.colorsRgb[i];
  }

  clear() {
    this.cache.clear();
  }
}

const getGenerator = memoizeOne((colors: string[], theme: GrafanaTheme2) => {
  return new ColorGenerator(colors, theme);
});

export function clear(theme: GrafanaTheme2) {
  getGenerator([], theme);
}

export function getColorByKey(key: string, theme: GrafanaTheme2) {
  return getGenerator(colors, theme).getColorByKey(key);
}

export function getRgbColorByKey(key: string, theme: GrafanaTheme2): [number, number, number] {
  return getGenerator(colors, theme).getRgbColorByKey(key);
}

export function getFilteredColors(colorsHex: string[], theme: GrafanaTheme2) {
  const filtered = [...colorsHex];
  // Remove red as a span color because it looks like an error
  const redIndex = filtered.indexOf('#E24D42');
  if (redIndex > -1) {
    filtered.splice(redIndex, 1);
  }
  const redIndex2 = colorsHex.indexOf('#BF1B00');
  if (redIndex2 > -1) {
    filtered.splice(redIndex2, 1);
  }

  // Only add colors that have a contrast ratio >= 3 for the current theme
  let filteredColors = [];
  for (const color of filtered) {
    if (tinycolor.readability(theme.colors.background.primary, color) >= 3) {
      filteredColors.push(color);
    }
  }

  return filteredColors;
}
