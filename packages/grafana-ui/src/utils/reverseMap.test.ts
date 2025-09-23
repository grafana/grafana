import { reverseMap } from './reverseMap';

describe('Reverse map', () => {
  it('Maps elements in reverse', () => {
    const elements = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const reversedAndMapped = reverseMap(elements, (i) => i ** 2);
    expect(reversedAndMapped).toEqual([100, 81, 64, 49, 36, 25, 16, 9, 4, 1]);
  });

  it('Maps array of objects in reverse', () => {
    const elements = [{ title: 'this' }, { title: 'is' }, { title: 'a' }, { title: 'test' }];
    const reversedAndMapped = reverseMap(elements, (v) => ({ title: v.title.toUpperCase() }));
    expect(reversedAndMapped).toEqual([{ title: 'TEST' }, { title: 'A' }, { title: 'IS' }, { title: 'THIS' }]);
  });
});
