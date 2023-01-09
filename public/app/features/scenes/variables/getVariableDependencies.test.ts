import { getVariableDependencies } from './getVariableDependencies';

describe('getVariableDependencies', () => {
  it('Can get dependencies', () => {
    expect(getVariableDependencies('test.$plain ${withcurly} ${withformat:csv} [[deprecated]]')).toEqual([
      'plain',
      'withcurly',
      'withformat',
      'deprecated',
    ]);
  });
});
