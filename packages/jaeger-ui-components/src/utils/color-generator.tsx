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

  constructor(colorsHex: string[]) {
    this.colorsHex = colorsHex;
    this.colorsRgb = colorsHex.map(strToRgb);
    this.cache = new Map();
  }

  _getColorIndex(key: string): number {
    let i = this.cache.get(key);
    if (i == null) {
      const hash = this.hashCode(key.toLowerCase());
      const hashIndex = Math.abs(hash % this.colorsHex.length);
      // colors[4] is red (which we want to disallow as a span color because it looks like an error)
      i = hashIndex === 4 ? hashIndex + 1 : hashIndex;
      this.cache.set(key, i);
    }
    return i;
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

const getGenerator = memoizeOne((colors: string[]) => {
  return new ColorGenerator(colors);
});

export function clear() {
  getGenerator([]);
}

export function getColorByKey(key: string) {
  return getGenerator(colors).getColorByKey(key);
}

export function getRgbColorByKey(key: string): [number, number, number] {
  return getGenerator(colors).getRgbColorByKey(key);
}
