import { convertDurationToMilliseconds } from './utils';

describe('Heatmap utils', () => {
  const cases: Array<[string, number | undefined]> = [
    ['1', 1],
    ['6', 6],
    ['2.3', 2],
    ['1ms', 1],
    ['5MS', 5],
    ['1s', 1000],
    ['1.5s', undefined],
    ['1.2345s', undefined],
    ['one', undefined],
    ['20sec', undefined],
    ['', undefined],
  ];

  test.each(cases)('convertToMilliseconds can correctly convert "%s"', (input, output) => {
    expect(convertDurationToMilliseconds(input)).toEqual(output);
  });
});
