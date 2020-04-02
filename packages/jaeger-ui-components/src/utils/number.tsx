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

/**
 * given a number and a desired precision for the floating
 * side, return the number at the new precision.
 *
 * toFloatPrecision(3.55, 1) // 3.5
 * toFloatPrecision(0.04422, 2) // 0.04
 * toFloatPrecision(6.24e6, 2) // 6240000.00
 *
 * does not support numbers that use "e" notation on toString.
 *
 * @param {number} number
 * @param {number} precision
 * @return {number} number at new floating precision
 */
export function toFloatPrecision(number: number, precision: number): number {
  const log10Length = Math.floor(Math.log10(Math.abs(number))) + 1;
  const targetPrecision = precision + log10Length;

  if (targetPrecision <= 0) {
    return Math.trunc(number);
  }

  return Number(number.toPrecision(targetPrecision));
}
