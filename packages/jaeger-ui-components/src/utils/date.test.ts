// Copyright (c) 2020 The Jaeger Authors
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

import { formatDuration, ONE_MILLISECOND, ONE_SECOND, ONE_MINUTE, ONE_HOUR, ONE_DAY } from './date';

describe('formatDuration', () => {
  it('keeps microseconds the same', () => {
    expect(formatDuration(1)).toBe('1μs');
  });

  it('displays a maximum of 2 units and rounds the last one', () => {
    const input = 10 * ONE_DAY + 13 * ONE_HOUR + 30 * ONE_MINUTE;
    expect(formatDuration(input)).toBe('10d 14h');
  });

  it('skips units that are empty', () => {
    const input = 2 * ONE_DAY + 5 * ONE_MINUTE;
    expect(formatDuration(input)).toBe('2d');
  });

  it('displays milliseconds in decimals', () => {
    const input = 2 * ONE_MILLISECOND + 357;
    expect(formatDuration(input)).toBe('2.36ms');
  });

  it('displays seconds in decimals', () => {
    const input = 2 * ONE_SECOND + 357 * ONE_MILLISECOND;
    expect(formatDuration(input)).toBe('2.36s');
  });

  it('displays minutes in split units', () => {
    const input = 2 * ONE_MINUTE + 30 * ONE_SECOND + 555 * ONE_MILLISECOND;
    expect(formatDuration(input)).toBe('2m 31s');
  });

  it('displays hours in split units', () => {
    const input = 2 * ONE_HOUR + 30 * ONE_MINUTE + 30 * ONE_SECOND;
    expect(formatDuration(input)).toBe('2h 31m');
  });

  it('displays times less than a μs', () => {
    const input = 0.1;
    expect(formatDuration(input)).toBe('0.1μs');
  });

  it('displays times of 0', () => {
    const input = 0;
    expect(formatDuration(input)).toBe('0μs');
  });
});
