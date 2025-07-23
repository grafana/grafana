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

import { round as _round, dropWhile as _dropWhile } from 'lodash';
import moment from 'moment-timezone';

import { toFloatPrecision } from './number';

export const STANDARD_DATE_FORMAT = 'YYYY-MM-DD';
export const STANDARD_TIME_FORMAT = 'HH:mm';
export const ONE_MILLISECOND = 1000;
export const ONE_SECOND = 1000 * ONE_MILLISECOND;
export const ONE_MINUTE = 60 * ONE_SECOND;
export const ONE_HOUR = 60 * ONE_MINUTE;
export const ONE_DAY = 24 * ONE_HOUR;
export const DEFAULT_MS_PRECISION = Math.log10(ONE_MILLISECOND);

const UNIT_STEPS: Array<{ unit: string; microseconds: number; ofPrevious: number }> = [
  { unit: 'd', microseconds: ONE_DAY, ofPrevious: 24 },
  { unit: 'h', microseconds: ONE_HOUR, ofPrevious: 60 },
  { unit: 'm', microseconds: ONE_MINUTE, ofPrevious: 60 },
  { unit: 's', microseconds: ONE_SECOND, ofPrevious: 1000 },
  { unit: 'ms', microseconds: ONE_MILLISECOND, ofPrevious: 1000 },
  { unit: 'μs', microseconds: 1, ofPrevious: 1000 },
];

const quantizeDuration = (duration: number, floatPrecision: number, conversionFactor: number) =>
  toFloatPrecision(duration / conversionFactor, floatPrecision) * conversionFactor;

/**
 * @param {number} duration (in microseconds)
 * @returns {string} formatted, unit-labelled string with time in milliseconds
 */
export function formatDate(duration: number) {
  return moment(duration / ONE_MILLISECOND).format(STANDARD_DATE_FORMAT);
}

/**
 * @param {number} duration (in microseconds)
 * @returns {string} formatted, unit-labelled string with time in milliseconds
 */
export function formatTime(duration: number) {
  return moment(duration / ONE_MILLISECOND).format(STANDARD_TIME_FORMAT);
}

/**
 * @param {number} duration (in microseconds)
 * @returns {string} formatted, unit-labelled string with time in milliseconds
 */
export function formatMillisecondTime(duration: number) {
  const targetDuration = quantizeDuration(duration, DEFAULT_MS_PRECISION, ONE_MILLISECOND);
  return `${moment.duration(targetDuration / ONE_MILLISECOND).asMilliseconds()}ms`;
}

/**
 * @param {number} duration (in microseconds)
 * @returns {string} formatted, unit-labelled string with time in seconds
 */
export function formatSecondTime(duration: number) {
  const targetDuration = quantizeDuration(duration, DEFAULT_MS_PRECISION, ONE_SECOND);
  return `${moment.duration(targetDuration / ONE_MILLISECOND).asSeconds()}s`;
}

/**
 * Humanizes the duration for display.
 *
 * Example:
 * 5000ms => 5s
 * 1000μs => 1ms
 * 183840s => 2d 3h
 *
 * @param {number} duration (in microseconds)
 * @return {string} formatted duration
 */
export function formatDuration(duration: number): string {
  // Drop all units that are too large except the last one
  const [primaryUnit, secondaryUnit] = _dropWhile(
    UNIT_STEPS,
    ({ microseconds }, index) => index < UNIT_STEPS.length - 1 && microseconds > duration
  );

  if (primaryUnit.ofPrevious === 1000) {
    // If the unit is decimal based, display as a decimal
    return `${_round(duration / primaryUnit.microseconds, 2)}${primaryUnit.unit}`;
  }

  const primaryValue = Math.floor(duration / primaryUnit.microseconds);
  const primaryUnitString = `${primaryValue}${primaryUnit.unit}`;
  const secondaryValue = Math.round((duration / secondaryUnit.microseconds) % primaryUnit.ofPrevious);

  if (secondaryValue === 0) {
    return primaryUnitString;
  }

  const secondaryUnitString = `${secondaryValue}${secondaryUnit.unit}`;
  return `${primaryUnitString} ${secondaryUnitString}`;
}
