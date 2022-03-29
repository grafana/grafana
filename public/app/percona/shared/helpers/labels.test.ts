import { PrioritizedLabels } from '../core';
import { formatLabel, formatLabels } from './labels';

describe('Labels utils', () => {
  test('formatLabel', () => {
    expect(formatLabel(['testKey', '1337'])).toEqual('testKey=1337');
  });

  test('formatLabels', () => {
    expect(formatLabels({})).toEqual<PrioritizedLabels>({ primary: [], secondary: [] });
    expect(formatLabels({ testKey: '1337', testKey2: 'testValue' })).toEqual<PrioritizedLabels>({
      primary: [],
      secondary: ['testKey=1337', 'testKey2=testValue'],
    });
  });
});
