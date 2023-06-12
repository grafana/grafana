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

import tinycolor from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';

/**
 * Tries to get a dark variant color. Either by simply inverting the luminosity and darkening or lightening the color
 * a bit, or if base is provided, tries 2 variants of lighter and darker colors and checks which is more readable with
 * the base.
 * @param theme
 * @param hex
 * @param base
 */
export function autoColor(theme: GrafanaTheme2, hex: string, base?: string) {
  if (theme.isLight) {
    return hex;
  } else {
    if (base) {
      const color = tinycolor(hex);
      return tinycolor
        .mostReadable(
          base,
          [
            color.clone().lighten(25),
            color.clone().lighten(10),
            color,
            color.clone().darken(10),
            color.clone().darken(25),
          ],
          {
            includeFallbackColors: false,
          }
        )
        .toHex8String();
    }
    const color = tinycolor(hex).toHsl();
    color.l = 1 - color.l;
    const newColor = tinycolor(color);
    return newColor.isLight() ? newColor.darken(5).toHex8String() : newColor.lighten(5).toHex8String();
  }
}
