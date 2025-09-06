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

type THeightGetter = (index: number) => number;

/**
 * Keeps track of the height and y-position for anything sequenctial where
 * y-positions follow one-after-another and can be derived from the height of
 * the prior entries. The height is known from an accessor function parameter
 * to the methods that require new knowledge the heights.
 *
 * @export
 * @class Positions
 */
export default class Positions {
  /**
   * Indicates how far past the explicitly required height or y-values should
   * checked.
   */
  bufferLen: number;
  dataLen: number;
  heights: number[];
  /**
   * `lastI` keeps track of which values have already been visited. In many
   * scenarios, values do not need to be revisited. But, revisiting is required
   * when heights have changed, so `lastI` can be forced.
   */
  lastI: number;
  ys: number[];

  constructor(bufferLen: number) {
    this.ys = [];
    this.heights = [];
    this.bufferLen = bufferLen;
    this.dataLen = -1;
    this.lastI = -1;
  }

  /**
   * Used to make sure the length of y-values and heights is consistent with
   * the context; in particular `lastI` needs to remain valid.
   */
  profileData(dataLength: number) {
    if (dataLength !== this.dataLen) {
      this.dataLen = dataLength;
      this.ys.length = dataLength;
      this.heights.length = dataLength;
      if (this.lastI >= dataLength) {
        this.lastI = dataLength - 1;
      }
    }
  }

  /**
   * Calculate and save the heights and y-values, based on `heightGetter`, from
   * `lastI` until the`max` index; the starting point (`lastI`) can be forced
   * via the `forcedLastI` parameter.
   * @param {number=} forcedLastI
   */
  calcHeights(max: number, heightGetter: THeightGetter, forcedLastI?: number) {
    if (forcedLastI != null) {
      this.lastI = forcedLastI;
    }
    let _max = max + this.bufferLen;
    if (_max <= this.lastI) {
      return;
    }
    if (_max >= this.heights.length) {
      _max = this.heights.length - 1;
    }
    let i = this.lastI;
    if (this.lastI === -1) {
      i = 0;
      this.ys[0] = 0;
    }
    while (i <= _max) {
      const h = (this.heights[i] = heightGetter(i));
      this.ys[i + 1] = this.ys[i] + h;
      i++;
    }
    this.lastI = _max;
  }

  /**
   * Verify the height and y-values from `lastI` up to `yValue`.
   */
  calcYs(yValue: number, heightGetter: THeightGetter) {
    while ((this.ys[this.lastI] == null || yValue > this.ys[this.lastI]) && this.lastI < this.dataLen - 1) {
      this.calcHeights(this.lastI, heightGetter);
    }
  }

  /**
   * Get the latest height for index `_i`. If it's in new terretory
   * (_i > lastI), find the heights (and y-values) leading up to it. If it's in
   * known territory (_i <= lastI) and the height is different than what is
   * known, recalculate subsequent y values, but don't confirm the heights of
   * those items, just update based on the difference.
   */
  confirmHeight(_i: number, heightGetter: THeightGetter) {
    let i = _i;
    if (i > this.lastI) {
      this.calcHeights(i, heightGetter);
      return;
    }
    const h = heightGetter(i);
    if (h === this.heights[i]) {
      return;
    }
    const chg = h - this.heights[i];
    this.heights[i] = h;
    // shift the y positions by `chg` for all known y positions
    while (++i <= this.lastI) {
      this.ys[i] += chg;
    }
    if (this.ys[this.lastI + 1] != null) {
      this.ys[this.lastI + 1] += chg;
    }
  }

  /**
   * Given a target y-value (`yValue`), find the closest index (in the `.ys`
   * array) that is prior to the y-value; e.g. map from y-value to index in
   * `.ys`.
   */
  findFloorIndex(yValue: number, heightGetter: THeightGetter): number {
    this.calcYs(yValue, heightGetter);

    let imin = 0;
    let imax = this.lastI;

    if (this.ys.length < 2 || yValue < this.ys[1]) {
      return 0;
    }
    if (yValue > this.ys[imax]) {
      return imax;
    }
    let i;
    while (imin < imax) {
      i = (imin + 0.5 * (imax - imin)) | 0;
      if (yValue > this.ys[i]) {
        if (yValue <= this.ys[i + 1]) {
          return i;
        }
        imin = i;
      } else if (yValue < this.ys[i]) {
        if (yValue >= this.ys[i - 1]) {
          return i - 1;
        }
        imax = i;
      } else {
        return i;
      }
    }
    throw new Error(`unable to find floor index for y=${yValue}`);
  }

  /**
   * Get the `y` and `height` for a given row.
   *
   * @returns {{ height: number, y: number }}
   */
  getRowPosition(index: number, heightGetter: THeightGetter) {
    this.confirmHeight(index, heightGetter);
    return {
      height: this.heights[index],
      y: this.ys[index],
    };
  }

  /**
   * Get the estimated height of the whole shebang by extrapolating based on
   * the average known height.
   */
  getEstimatedHeight(): number {
    const known = this.ys[this.lastI] + this.heights[this.lastI];
    if (this.lastI >= this.dataLen - 1) {
      return known | 0;
    }

    return ((known / (this.lastI + 1)) * this.heights.length) | 0;
  }
}
