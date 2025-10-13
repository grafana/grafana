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

import * as sortUtils from './sort';

it('localeStringComparator() provides a case-insensitive sort', () => {
  const arr = ['Z', 'ab', 'AC'];
  expect(arr.slice().sort()).toEqual(['AC', 'Z', 'ab']);
  expect(arr.slice().sort(sortUtils.localeStringComparator)).toEqual(['ab', 'AC', 'Z']);
});

it('localeStringComparator() should properly sort a list of strings', () => {
  const arr = ['allen', 'Gustav', 'paul', 'Tim', 'abernathy', 'tucker', 'Steve', 'mike', 'John', 'Paul'];
  expect(arr.sort(sortUtils.localeStringComparator)).toEqual([
    'abernathy',
    'allen',
    'Gustav',
    'John',
    'mike',
    'paul',
    'Paul',
    'Steve',
    'Tim',
    'tucker',
  ]);
});

it('classNameForSortDir() should return the proper asc classes', () => {
  expect(sortUtils.classNameForSortDir(1)).toBe('sorted ascending');
});

it('classNameForSortDir() should return the proper desc classes', () => {
  expect(sortUtils.classNameForSortDir(-1)).toBe('sorted descending');
});

it('getNewSortForClick() should sort to the defaultDir if new column', () => {
  // no defaultDir provided
  expect(sortUtils.getNewSortForClick({ key: 'alpha', dir: 1 }, { name: 'beta' })).toEqual({
    key: 'beta',
    dir: 1,
  });

  // defaultDir provided
  expect(sortUtils.getNewSortForClick({ key: 'alpha', dir: 1 }, { name: 'beta', defaultDir: -1 })).toEqual({
    key: 'beta',
    dir: -1,
  });
});

it('getNewSortForClick() should toggle direction if same column', () => {
  expect(sortUtils.getNewSortForClick({ key: 'alpha', dir: 1 }, { name: 'alpha' })).toEqual({
    key: 'alpha',
    dir: -1,
  });

  expect(sortUtils.getNewSortForClick({ key: 'alpha', dir: -1 }, { name: 'alpha' })).toEqual({
    key: 'alpha',
    dir: 1,
  });
});
