import { distribute, SPACE_BETWEEN, SPACE_AROUND, SPACE_EVENLY, type Each } from './distribute';

type CallRecord = { idx: number; offPct: number; dimPct: number };

function collectCalls(numItems: number, sizeFactor: number, justify: number, onlyIdx: number | null): CallRecord[] {
  const calls: CallRecord[] = [];
  const each: Each = (idx, offPct, dimPct) => calls.push({ idx, offPct, dimPct });
  distribute(numItems, sizeFactor, justify, onlyIdx, each);
  return calls;
}

describe('distribute', () => {
  describe('SPACE_BETWEEN', () => {
    it('distributes 2 items with sizeFactor 0.5', () => {
      const calls = collectCalls(2, 0.5, SPACE_BETWEEN, null);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ idx: 0, offPct: 0, dimPct: 0.25 });
      expect(calls[1].idx).toBe(1);
      expect(calls[1].offPct).toEqual(0.75);
      expect(calls[1].dimPct).toEqual(0.25);
    });

    it('distributes 3 items with sizeFactor 0.6', () => {
      const calls = collectCalls(3, 0.6, SPACE_BETWEEN, null);
      expect(calls).toHaveLength(3);
      expect(calls[0].offPct).toBe(0);
      expect(calls[0].dimPct).toEqual(0.2);
      expect(calls[1].offPct).toEqual(0.4);
      expect(calls[2].offPct).toEqual(0.8);
    });
  });

  describe('SPACE_AROUND', () => {
    it('distributes 2 items with sizeFactor 0.5', () => {
      const calls = collectCalls(2, 0.5, SPACE_AROUND, null);
      expect(calls).toHaveLength(2);
      expect(calls[0].offPct).toEqual(0.125);
      expect(calls[0].dimPct).toEqual(0.25);
      expect(calls[1].offPct).toEqual(0.625);
      expect(calls[1].dimPct).toEqual(0.25);
    });
  });

  describe('SPACE_EVENLY', () => {
    it('distributes 2 items with sizeFactor 0.5', () => {
      const calls = collectCalls(2, 0.5, SPACE_EVENLY, null);
      expect(calls).toHaveLength(2);
      expect(calls[0].offPct).toBeCloseTo(0.166667, 5);
      expect(calls[0].dimPct).toEqual(0.25);
      expect(calls[1].offPct).toBeCloseTo(0.583333, 5);
      expect(calls[1].dimPct).toEqual(0.25);
    });
  });

  describe('unknown justify', () => {
    it('uses gap 0 and offs 0 when justify is 0', () => {
      const calls = collectCalls(3, 0.5, 0, null);
      expect(calls).toHaveLength(3);
      expect(calls[0].offPct).toBe(0);
      expect(calls[0].dimPct).toBeCloseTo(0.166667, 5);
      expect(calls[1].offPct).toBeCloseTo(0.166667, 5);
      expect(calls[2].offPct).toBeCloseTo(0.333333, 5);
    });

    it('uses gap 0 and offs 0 when justify is invalid', () => {
      const calls = collectCalls(2, 0.5, 99, null);
      expect(calls).toHaveLength(2);
      expect(calls[0].offPct).toBe(0);
      expect(calls[1].offPct).toEqual(0.25);
    });
  });

  describe('edge cases', () => {
    it('handles numItems 1 with SPACE_BETWEEN (gap would be Infinity)', () => {
      const calls = collectCalls(1, 0.5, SPACE_BETWEEN, null);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ idx: 0, offPct: 0, dimPct: 0.5 });
    });

    it('handles numItems 0 without calling each', () => {
      const calls = collectCalls(0, 0.5, SPACE_BETWEEN, null);
      expect(calls).toHaveLength(0);
    });

    it('handles sizeFactor 1 (space 0)', () => {
      const calls = collectCalls(2, 1, SPACE_BETWEEN, null);
      expect(calls).toHaveLength(2);
      expect(calls[0].offPct).toBe(0);
      expect(calls[0].dimPct).toEqual(0.5);
      expect(calls[1].offPct).toEqual(0.5);
    });
  });

  describe('onlyIdx', () => {
    it('calls each only for the specified index when onlyIdx is set', () => {
      const calls = collectCalls(5, 0.5, SPACE_BETWEEN, 2);
      expect(calls).toHaveLength(1);
      expect(calls[0].idx).toBe(2);
      expect(calls[0].offPct).toEqual(0.45);
      expect(calls[0].dimPct).toEqual(0.1);
    });

    it('calls each for all indices when onlyIdx is null', () => {
      const calls = collectCalls(3, 0.6, SPACE_AROUND, null);
      expect(calls).toHaveLength(3);
      expect(calls.map((c) => c.idx)).toEqual([0, 1, 2]);
    });
  });
});
