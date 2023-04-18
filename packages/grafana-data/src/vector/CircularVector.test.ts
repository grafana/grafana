import { CircularVector } from './CircularVector';

describe('Check Circular Vector', () => {
  it('should append values', () => {
    const buffer = [1, 2, 3];
    const v = new CircularVector({ buffer }); // tail is default option
    expect(v.toArray()).toEqual([1, 2, 3]);

    v.add(4);
    expect(v.toArray()).toEqual([2, 3, 4]);

    v.add(5);
    expect(v.toArray()).toEqual([3, 4, 5]);

    v.add(6);
    expect(v.toArray()).toEqual([4, 5, 6]);

    v.add(7);
    expect(v.toArray()).toEqual([5, 6, 7]);

    v.add(8);
    expect(v.toArray()).toEqual([6, 7, 8]);

    v.push(9, 10);
    expect(v.toArray()).toEqual([8, 9, 10]);
  });

  it('should grow buffer until it hits capacity (append)', () => {
    const v = new CircularVector({ capacity: 3 }); // tail is default option
    expect(v.toArray()).toEqual([]);

    v.add(1);
    expect(v.toArray()).toEqual([1]);

    v.add(2);
    expect(v.toArray()).toEqual([1, 2]);

    v.add(3);
    expect(v.toArray()).toEqual([1, 2, 3]);

    v.add(4);
    expect(v.toArray()).toEqual([2, 3, 4]);

    v.add(5);
    expect(v.toArray()).toEqual([3, 4, 5]);
  });

  it('should prepend values', () => {
    const buffer = [3, 2, 1];
    const v = new CircularVector({ buffer, append: 'head' });
    expect(v.toArray()).toEqual([3, 2, 1]);

    v.add(4);
    expect(v.toArray()).toEqual([4, 3, 2]);

    v.add(5);
    expect(v.toArray()).toEqual([5, 4, 3]);

    v.add(6);
    expect(v.toArray()).toEqual([6, 5, 4]);

    v.add(7);
    expect(v.toArray()).toEqual([7, 6, 5]);

    v.add(8);
    expect(v.toArray()).toEqual([8, 7, 6]);
  });

  it('should expand buffer and then prepend', () => {
    const v = new CircularVector({ capacity: 3, append: 'head' });
    expect(v.toArray()).toEqual([]);

    v.add(1);
    expect(v.toArray()).toEqual([1]);

    v.add(2);
    expect(v.toArray()).toEqual([2, 1]);

    v.add(3);
    expect(v.toArray()).toEqual([3, 2, 1]);

    v.add(4);
    expect(v.toArray()).toEqual([4, 3, 2]);

    v.add(5);
    expect(v.toArray()).toEqual([5, 4, 3]);
  });

  it('should reduce size and keep working (tail)', () => {
    const buffer = [1, 2, 3, 4, 5];
    const v = new CircularVector({ buffer });
    expect(v.toArray()).toEqual([1, 2, 3, 4, 5]);

    v.setCapacity(3);
    expect(v.toArray()).toEqual([3, 4, 5]);

    v.add(6);
    expect(v.toArray()).toEqual([4, 5, 6]);

    v.add(7);
    expect(v.toArray()).toEqual([5, 6, 7]);
  });

  it('should reduce size and keep working (head)', () => {
    const buffer = [5, 4, 3, 2, 1];
    const v = new CircularVector({ buffer, append: 'head' });
    expect(v.toArray()).toEqual([5, 4, 3, 2, 1]);

    v.setCapacity(3);
    expect(v.toArray()).toEqual([5, 4, 3]);

    v.add(6);
    expect(v.toArray()).toEqual([6, 5, 4]);

    v.add(7);
    expect(v.toArray()).toEqual([7, 6, 5]);
  });

  it('change buffer direction', () => {
    const buffer = [1, 2, 3];
    const v = new CircularVector({ buffer });
    expect(v.toArray()).toEqual([1, 2, 3]);

    v.setAppendMode('head');
    expect(v.toArray()).toEqual([3, 2, 1]);

    v.add(4);
    expect(v.toArray()).toEqual([4, 3, 2]);

    v.setAppendMode('tail');
    v.add(5);
    expect(v.toArray()).toEqual([3, 4, 5]);
  });
});
