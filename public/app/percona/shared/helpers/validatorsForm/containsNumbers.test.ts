import { containsNumber } from './containsNumber';

describe('validators :: containsNumber', () => {
  it('returns an error if there are no numbers characters in the passed string', () => {
    expect(containsNumber('123')).toEqual(undefined);
    expect(containsNumber('test123')).toEqual(undefined);
    expect(containsNumber('test')).toEqual('Must include at least one number');
  });
});
