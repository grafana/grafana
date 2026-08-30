import { findRects, intersects, pointWithin, Quadtree, type Rect } from './quadtree';

function rect(x: number, y: number, w: number, h: number, sidx?: number, didx?: number): Rect {
  const r: Rect = { x, y, w, h };
  if (sidx != null) {
    r.sidx = sidx;
  }
  if (didx != null) {
    r.didx = didx;
  }
  return r;
}

describe('pointWithin', () => {
  it.each([
    { args: [5, 5, 0, 0, 10, 10], expected: true, desc: 'returns true when point is strictly inside rect' },
    { args: [0, 5, 0, 0, 10, 10], expected: true, desc: 'returns true when point is on left boundary' },
    { args: [10, 5, 0, 0, 10, 10], expected: true, desc: 'returns true when point is on right boundary' },
    { args: [5, 0, 0, 0, 10, 10], expected: true, desc: 'returns true when point is on top boundary' },
    { args: [5, 10, 0, 0, 10, 10], expected: true, desc: 'returns true when point is on bottom boundary' },
    { args: [-1, 5, 0, 0, 10, 10], expected: false, desc: 'returns false when point is outside to the left' },
    { args: [11, 5, 0, 0, 10, 10], expected: false, desc: 'returns false when point is outside to the right' },
    { args: [5, -1, 0, 0, 10, 10], expected: false, desc: 'returns false when point is above rect' },
    { args: [5, 11, 0, 0, 10, 10], expected: false, desc: 'returns false when point is below rect' },
    { args: [1, 1, 0, 0, 0, 0], expected: false, desc: 'returns false for degenerate rect when point is outside' },
  ])('pointWithin tests: $desc', (test) => {
    // @ts-expect-error tuple type mismatch
    expect(pointWithin(...test.args)).toBe(test.expected);
  });
});

describe('intersects', () => {
  it.each([
    {
      args: [
        [0, 0, 10, 10],
        [5, 5, 10, 10],
      ],
      expected: true,
      desc: 'returns true when rects overlap',
    },
    {
      args: [
        [0, 0, 10, 10],
        [10, 0, 10, 10],
      ],
      expected: true,
      desc: 'returns true when rects touch at edge',
    },
    {
      args: [
        [0, 0, 100, 100],
        [10, 10, 20, 20],
      ],
      expected: true,
      desc: 'returns true when outer rect fully contains inner',
    },
    {
      args: [
        [10, 10, 20, 20],
        [0, 0, 100, 100],
      ],
      expected: true,
      desc: 'returns true when inner rect is fully contained by outer',
    },
    {
      args: [
        [0, 0, 10, 10],
        [20, 0, 10, 10],
      ],
      expected: false,
      desc: 'returns false when rects are disjoint to the left/right',
    },
    {
      args: [
        [0, 0, 10, 10],
        [0, 20, 10, 10],
      ],
      expected: false,
      desc: 'returns false when rects are disjoint above/below',
    },
    {
      args: [
        [0, 0, 10, 10],
        [0, 0, 10, 10],
      ],
      expected: true,
      desc: 'returns true for identical rects',
    },
  ])('intersects: $desc', (test) => {
    const [a, b] = test.args;
    // @ts-expect-error tuple type mismatch
    expect(intersects(rect(...a), rect(...b))).toBe(test.expected);
  });
});

describe('findRects', () => {
  it('returns empty array for empty quadtree', () => {
    const qt = new Quadtree(0, 0, 100, 100);
    expect(findRects(qt)).toEqual([]);
  });

  it('returns all rects when no sidx/didx filter', () => {
    const qt = new Quadtree(0, 0, 100, 100);
    const r1 = rect(10, 10, 5, 5, 1, 0);
    const r2 = rect(20, 20, 5, 5, 2, 1);
    qt.add(r1);
    qt.add(r2);
    const result = findRects(qt);
    expect(result).toEqual([r1, r2]);
  });

  it('filters by sidx when provided', () => {
    const qt = new Quadtree(0, 0, 100, 100);
    qt.add(rect(10, 10, 5, 5, 1, 0));
    qt.add(rect(20, 20, 5, 5, 2, 1));
    qt.add(rect(30, 30, 5, 5, 1, 2));
    const result = findRects(qt, 1);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.sidx === 1)).toBe(true);
  });

  it('filters by didx when provided', () => {
    const qt = new Quadtree(0, 0, 100, 100);
    qt.add(rect(10, 10, 5, 5, 1, 0));
    qt.add(rect(20, 20, 5, 5, 2, 1));
    qt.add(rect(30, 30, 5, 5, 1, 1));
    const result = findRects(qt, undefined, 1);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.didx === 1)).toBe(true);
  });

  it('filters by both sidx and didx when both provided', () => {
    const qt = new Quadtree(0, 0, 100, 100);
    qt.add(rect(10, 10, 5, 5, 1, 0));
    qt.add(rect(20, 20, 5, 5, 1, 1));
    qt.add(rect(30, 30, 5, 5, 2, 1));
    const result = findRects(qt, 1, 1);
    expect(result).toHaveLength(1);
    expect(result[0].sidx).toBe(1);
    expect(result[0].didx).toBe(1);
  });

  it('recurses into child quads after split', () => {
    const qt = new Quadtree(0, 0, 100, 100);
    for (let i = 0; i < 11; i++) {
      qt.add(rect(i * 5, i * 5, 2, 2, 0, i));
    }
    const result = findRects(qt);
    expect(result).toHaveLength(11);
  });
});

describe('Quadtree', () => {
  describe('constructor', () => {
    it('initializes o as empty array and q as null', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      expect(qt.o).toEqual([]);
      expect(qt.q).toBeNull();
    });

    it('stores x, y, w, h, and level', () => {
      const qt = new Quadtree(10, 20, 50, 60, 2);
      expect(qt.x).toBe(10);
      expect(qt.y).toBe(20);
      expect(qt.w).toBe(50);
      expect(qt.h).toBe(60);
      expect(qt.l).toBe(2);
    });

    it('defaults level to 0', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      expect(qt.l).toBe(0);
    });
  });

  describe('split', () => {
    it('creates 4 children in order: top-right, top-left, bottom-left, bottom-right', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      qt.split();
      if (!qt.q) {
        throw new Error('Expected qt.q after split');
      }
      const q = qt.q;
      expect(q).toHaveLength(4);
      expect(q[0]).toMatchObject({ x: 50, y: 0, w: 50, h: 50 });
      expect(q[1]).toMatchObject({ x: 0, y: 0, w: 50, h: 50 });
      expect(q[2]).toMatchObject({ x: 0, y: 50, w: 50, h: 50 });
      expect(q[3]).toMatchObject({ x: 50, y: 50, w: 50, h: 50 });
    });

    it('child dimensions are half of parent', () => {
      const qt = new Quadtree(10, 20, 80, 60);
      qt.split();
      if (!qt.q) {
        throw new Error('Expected qt.q after split');
      }
      const q = qt.q;
      expect(q[0].w).toBe(40);
      expect(q[0].h).toBe(30);
    });

    it('child level is l + 1', () => {
      const qt = new Quadtree(0, 0, 100, 100, 1);
      qt.split();
      if (!qt.q) {
        throw new Error('Expected qt.q after split');
      }
      const q = qt.q;
      expect(q[0].l).toBe(2);
    });
  });

  describe('quads', () => {
    it('invokes callback for quad overlapping query region', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      qt.split();
      const invoked: Quadtree[] = [];
      qt.quads(10, 10, 5, 5, (q) => invoked.push(q));
      expect(invoked).toHaveLength(1);
      expect(invoked[0]).toMatchObject({ x: 0, y: 0, w: 50, h: 50 });
    });

    it('rect spanning center invokes all 4 quads', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      qt.split();
      const invoked: Quadtree[] = [];
      qt.quads(40, 40, 25, 25, (q) => invoked.push(q));
      expect(invoked).toHaveLength(4);
    });

    it('rect in bottom-right corner invokes only that quad', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      qt.split();
      const invoked: Quadtree[] = [];
      qt.quads(75, 75, 10, 10, (q) => invoked.push(q));
      expect(invoked).toHaveLength(1);
      expect(invoked[0]).toMatchObject({ x: 50, y: 50, w: 50, h: 50 });
    });
  });

  describe('add', () => {
    it('adds rect to leaf node', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      const r = rect(10, 10, 5, 5);
      qt.add(r);
      expect(qt.o).toContain(r);
      expect(qt.o).toHaveLength(1);
    });

    it('splits when leaf has more than 10 rects and level < 4', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      for (let i = 0; i < 11; i++) {
        qt.add(rect(i * 8, i * 8, 2, 2));
      }
      expect(qt.q).not.toBeNull();
      expect(qt.o).toHaveLength(0);
    });

    it('routes rect to overlapping child when already split', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      qt.split();
      const r = rect(10, 10, 5, 5);
      qt.add(r);
      if (!qt.q) {
        throw new Error('Expected qt.q after split');
      }
      const q = qt.q;
      const topLeft = q[1];
      expect(topLeft.o).toContain(r);
    });
  });

  describe('get', () => {
    it('invokes callback for each rect in leaf', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      const r1 = rect(10, 10, 5, 5);
      const r2 = rect(20, 20, 5, 5);
      qt.add(r1);
      qt.add(r2);
      const found: Rect[] = [];
      qt.get(0, 0, 100, 100, (o) => found.push(o));
      expect(found).toHaveLength(2);
      expect(found).toContain(r1);
      expect(found).toContain(r2);
    });

    it('point query returns rects containing that point', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      const r = rect(10, 10, 20, 20);
      qt.add(r);
      const found: Rect[] = [];
      qt.get(15, 15, 1, 1, (o) => found.push(o));
      expect(found).toHaveLength(1);
      expect(found[0]).toBe(r);
    });

    it('recurses into overlapping quads when split', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      for (let i = 0; i < 11; i++) {
        qt.add(rect(i * 8, i * 8, 2, 2));
      }
      const found: Rect[] = [];
      qt.get(0, 0, 100, 100, (o) => found.push(o));
      expect(found).toHaveLength(11);
    });
  });

  describe('clear', () => {
    it('empties o and sets q to null', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      qt.add(rect(10, 10, 5, 5));
      qt.clear();
      expect(qt.o).toHaveLength(0);
      expect(qt.q).toBeNull();
    });

    it('clears split node', () => {
      const qt = new Quadtree(0, 0, 100, 100);
      for (let i = 0; i < 11; i++) {
        qt.add(rect(i * 8, i * 8, 2, 2));
      }
      expect(qt.q).not.toBeNull();
      qt.clear();
      expect(qt.o).toHaveLength(0);
      expect(qt.q).toBeNull();
    });
  });
});
