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

import { getColorByKey, clear } from './color-generator';

it('gives the same color for the same key', () => {
  clear();
  const colorOne = getColorByKey('serviceA');
  const colorTwo = getColorByKey('serviceA');
  expect(colorOne).toBe(colorTwo);
});

it('gives different colors for each for each key', () => {
  clear();
  const colorOne = getColorByKey('serviceA');
  const colorTwo = getColorByKey('serviceB');
  expect(colorOne).not.toBe(colorTwo);
});

it('should not allow red', () => {
  clear();
  // when aPAKNMeFcF is hashed it's index is 4
  // which is red, which we disallow because it looks like an error
  const colorOne = getColorByKey('aPAKNMeFcF');
  expect(colorOne).not.toBe('#E24D42');
});
