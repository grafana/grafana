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

import { createTheme } from '@grafana/data';
import { colors } from '@grafana/ui';

import { getColorByKey, getFilteredColors, clear } from './color-generator';

const colorsToFilter = [...colors];
let theme = createTheme();

it('gives the same color for the same key', () => {
  clear(theme);
  const colorOne = getColorByKey('serviceA', createTheme());
  const colorTwo = getColorByKey('serviceA', createTheme());
  expect(colorOne).toBe(colorTwo);
});

it('gives different colors for each key', () => {
  clear(theme);
  const colorOne = getColorByKey('serviceA', createTheme());
  const colorTwo = getColorByKey('serviceB', createTheme());
  expect(colorOne).not.toBe(colorTwo);
});

it('should not allow red', () => {
  expect(colorsToFilter.indexOf('#E24D42')).toBe(4);
  expect(colorsToFilter.indexOf('#BF1B00')).toBe(28);
  const filteredColors = getFilteredColors(colorsToFilter, createTheme());
  expect(filteredColors.indexOf('#E24D42')).toBe(-1);
  expect(filteredColors.indexOf('#BF1B00')).toBe(-1);
});

it('should not allow colors with a contrast ratio < 3 in light mode', () => {
  expect(colorsToFilter.indexOf('#7EB26D')).toBe(0);
  expect(colorsToFilter.indexOf('#EAB839')).toBe(1);
  const filteredColors = getFilteredColors(colorsToFilter, createTheme({ colors: { mode: 'light' } }));
  expect(filteredColors.indexOf('#7EB26D')).toBe(-1);
  expect(filteredColors.indexOf('#EAB839')).toBe(-1);
});

it('should not allow colors with a contrast ratio < 3 in dark mode', () => {
  expect(colorsToFilter.indexOf('#890F02')).toBe(11);
  expect(colorsToFilter.indexOf('#0A437C')).toBe(12);
  const filteredColors = getFilteredColors(colorsToFilter, createTheme({ colors: { mode: 'dark' } }));
  expect(filteredColors.indexOf('#890F02')).toBe(-1);
  expect(filteredColors.indexOf('#0A437C')).toBe(-1);
});

it('should not allow a color that is the same as the previous color', () => {
  clear(theme);
  const colorOne = getColorByKey('random4', theme); // #447EBC
  const colorTwo = getColorByKey('random17', theme); // #447EBC
  expect(colorOne).not.toBe(colorTwo);
  expect(colorOne).toBe('#447EBC');
  expect(colorTwo).toBe('#B7DBAB');
});

it('should not allow a color that looks similar to the previous color', () => {
  theme = createTheme({ colors: { mode: 'light' } });
  clear(theme);
  const colorOne = getColorByKey('random9', theme); // #58140C
  const colorTwo = getColorByKey('random18', theme); // #511749
  expect(colorOne).toBe('#58140C');
  // #1F78C1 is the next color that has a contrast ratio >= 3 for the current theme
  expect(colorTwo).toBe('#1F78C1');
});
