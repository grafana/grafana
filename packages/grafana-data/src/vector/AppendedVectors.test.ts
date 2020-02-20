import { ArrayVector } from './ArrayVector';
import { AppendedVectors } from './AppendedVectors';

describe('Check Appending Vector', () => {
  it('should transparently join them', () => {
    const appended = new AppendedVectors();
    appended.append(new ArrayVector([1, 2, 3]));
    appended.append(new ArrayVector([4, 5, 6]));
    appended.append(new ArrayVector([7, 8, 9]));
    expect(appended.length).toEqual(9);

    appended.setLength(5);
    expect(appended.length).toEqual(5);
    appended.append(new ArrayVector(['a', 'b', 'c']));
    expect(appended.length).toEqual(8);
    expect(appended.toArray()).toEqual([1, 2, 3, 4, 5, 'a', 'b', 'c']);

    appended.setLength(2);
    appended.setLength(6);
    appended.append(new ArrayVector(['x', 'y', 'z']));
    expect(appended.toArray()).toEqual([1, 2, undefined, undefined, undefined, undefined, 'x', 'y', 'z']);
  });

  it('should be iterable', () => {
    const appended = new AppendedVectors();
    appended.append(new ArrayVector([1, 2, 3]));
    appended.append(new ArrayVector([4, 5, 6]));
    appended.append(new ArrayVector([7, 8, 9]));
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    expect([...appended]).toEqual(expected);

    let i = 0;
    for (const val of appended) {
      expect(val).toEqual(expected[i]);
      i++;
    }
  });
});
