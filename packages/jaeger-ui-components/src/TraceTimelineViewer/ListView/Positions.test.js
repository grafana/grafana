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

import Positions from './Positions';

describe('Positions', () => {
  const bufferLen = 1;
  const getHeight = (i) => i * 2 + 2;
  let ps;

  beforeEach(() => {
    ps = new Positions(bufferLen);
    ps.profileData(10);
  });

  describe('constructor()', () => {
    it('intializes member variables correctly', () => {
      ps = new Positions(1);
      expect(ps.ys).toEqual([]);
      expect(ps.heights).toEqual([]);
      expect(ps.bufferLen).toBe(1);
      expect(ps.dataLen).toBe(-1);
      expect(ps.lastI).toBe(-1);
    });
  });

  describe('profileData(...)', () => {
    it('manages increases in data length correctly', () => {
      expect(ps.dataLen).toBe(10);
      expect(ps.ys.length).toBe(10);
      expect(ps.heights.length).toBe(10);
      expect(ps.lastI).toBe(-1);
    });

    it('manages decreases in data length correctly', () => {
      ps.lastI = 9;
      ps.profileData(5);
      expect(ps.dataLen).toBe(5);
      expect(ps.ys.length).toBe(5);
      expect(ps.heights.length).toBe(5);
      expect(ps.lastI).toBe(4);
    });

    it('does nothing when data length is unchanged', () => {
      expect(ps.dataLen).toBe(10);
      expect(ps.ys.length).toBe(10);
      expect(ps.heights.length).toBe(10);
      expect(ps.lastI).toBe(-1);
      ps.profileData(10);
      expect(ps.dataLen).toBe(10);
      expect(ps.ys.length).toBe(10);
      expect(ps.heights.length).toBe(10);
      expect(ps.lastI).toBe(-1);
    });
  });

  describe('calcHeights()', () => {
    it('updates lastI correctly', () => {
      ps.calcHeights(1, getHeight);
      expect(ps.lastI).toBe(bufferLen + 1);
    });

    it('saves the heights and y-values up to `lastI <= max + bufferLen`', () => {
      const ys = [0, 2, 6, 12];
      ys.length = 10;
      const heights = [2, 4, 6];
      heights.length = 10;
      ps.calcHeights(1, getHeight);
      expect(ps.ys).toEqual(ys);
      expect(ps.heights).toEqual(heights);
    });

    it('does nothing when `max + buffer <= lastI`', () => {
      ps.calcHeights(2, getHeight);
      const ys = ps.ys.slice();
      const heights = ps.heights.slice();
      ps.calcHeights(1, getHeight);
      expect(ps.ys).toEqual(ys);
      expect(ps.heights).toEqual(heights);
    });

    describe('recalculates values up to `max + bufferLen` when `max + buffer <= lastI` and `forcedLastI = 0` is passed', () => {
      beforeEach(() => {
        // the initial state for the test
        ps.calcHeights(2, getHeight);
      });

      it('test-case has a valid initial state', () => {
        const initialYs = [0, 2, 6, 12, 20];
        initialYs.length = 10;
        const initialHeights = [2, 4, 6, 8];
        initialHeights.length = 10;
        expect(ps.ys).toEqual(initialYs);
        expect(ps.heights).toEqual(initialHeights);
        expect(ps.lastI).toBe(3);
      });

      it('recalcualtes the y-values correctly', () => {
        // recalc a sub-set of the calcualted values using a different getHeight
        ps.calcHeights(1, () => 2, 0);
        const ys = [0, 2, 4, 6, 20];
        ys.length = 10;
        expect(ps.ys).toEqual(ys);
      });
      it('recalcualtes the heights correctly', () => {
        // recalc a sub-set of the calcualted values using a different getHeight
        ps.calcHeights(1, () => 2, 0);
        const heights = [2, 2, 2, 8];
        heights.length = 10;
        expect(ps.heights).toEqual(heights);
      });
      it('saves lastI correctly', () => {
        // recalc a sub-set of the calcualted values
        ps.calcHeights(1, getHeight, 0);
        expect(ps.lastI).toBe(2);
      });
    });

    it('limits caclulations to the known data length', () => {
      ps.calcHeights(999, getHeight);
      expect(ps.lastI).toBe(ps.dataLen - 1);
    });
  });

  describe('calcYs()', () => {
    it('scans forward until `yValue` is met or exceeded', () => {
      ps.calcYs(11, getHeight);
      const ys = [0, 2, 6, 12, 20];
      ys.length = 10;
      const heights = [2, 4, 6, 8];
      heights.length = 10;
      expect(ps.ys).toEqual(ys);
      expect(ps.heights).toEqual(heights);
    });

    it('exits early if the known y-values exceed `yValue`', () => {
      ps.calcYs(11, getHeight);
      const spy = jest.spyOn(ps, 'calcHeights');
      ps.calcYs(10, getHeight);
      expect(spy).not.toHaveBeenCalled();
    });

    it('exits when exceeds the data length even if yValue is unmet', () => {
      ps.calcYs(999, getHeight);
      expect(ps.ys[ps.ys.length - 1]).toBeLessThan(999);
    });
  });

  describe('findFloorIndex()', () => {
    beforeEach(() => {
      ps.calcYs(11, getHeight);
      // Note: ps.ys = [0, 2, 6, 12, 20, undefined x 5];
    });

    it('scans y-values for index that equals or precedes `yValue`', () => {
      let i = ps.findFloorIndex(3, getHeight);
      expect(i).toBe(1);
      i = ps.findFloorIndex(21, getHeight);
      expect(i).toBe(4);
      ps.calcYs(999, getHeight);
      i = ps.findFloorIndex(11, getHeight);
      expect(i).toBe(2);
      i = ps.findFloorIndex(12, getHeight);
      expect(i).toBe(3);
      i = ps.findFloorIndex(20, getHeight);
      expect(i).toBe(4);
    });

    it('is robust against non-positive y-values', () => {
      let i = ps.findFloorIndex(0, getHeight);
      expect(i).toBe(0);
      i = ps.findFloorIndex(-10, getHeight);
      expect(i).toBe(0);
    });

    it('scans no further than dataLen even if `yValue` is unmet', () => {
      const i = ps.findFloorIndex(999, getHeight);
      expect(i).toBe(ps.lastI);
    });
  });

  describe('getEstimatedHeight()', () => {
    const simpleGetHeight = () => 2;

    beforeEach(() => {
      ps.calcYs(5, simpleGetHeight);
      // Note: ps.ys = [0, 2, 4, 6, 8, undefined x 5];
    });

    it('returns the estimated max height, surpassing known values', () => {
      const estHeight = ps.getEstimatedHeight();
      expect(estHeight).toBeGreaterThan(ps.heights[ps.lastI]);
    });

    it('returns the known max height, if all heights have been calculated', () => {
      ps.calcYs(999, simpleGetHeight);
      const totalHeight = ps.getEstimatedHeight();
      expect(totalHeight).toBeGreaterThan(ps.heights[ps.heights.length - 1]);
    });
  });

  describe('confirmHeight()', () => {
    const simpleGetHeight = () => 2;

    beforeEach(() => {
      ps.calcYs(5, simpleGetHeight);
      // Note: ps.ys = [0, 2, 4, 6, 8, undefined x 5];
    });

    it('calculates heights up to and including `_i` if necessary', () => {
      const startNumHeights = ps.heights.filter(Boolean).length;
      const calcHeightsSpy = jest.spyOn(ps, 'calcHeights');
      ps.confirmHeight(7, simpleGetHeight);
      const endNumHeights = ps.heights.filter(Boolean).length;
      expect(startNumHeights).toBeLessThan(endNumHeights);
      expect(calcHeightsSpy).toHaveBeenCalled();
    });

    it('invokes `heightGetter` at `_i` to compare result with known height', () => {
      const getHeightSpy = jest.fn(simpleGetHeight);
      ps.confirmHeight(ps.lastI - 1, getHeightSpy);
      expect(getHeightSpy).toHaveBeenCalled();
    });

    it('cascades difference in observed height vs known height to known y-values', () => {
      const getLargerHeight = () => simpleGetHeight() + 2;
      const knownYs = ps.ys.slice();
      const expectedYValues = knownYs.map((value) => (value ? value + 2 : value));
      ps.confirmHeight(0, getLargerHeight);
      expect(ps.ys).toEqual(expectedYValues);
    });
  });
});
