import { containsLowercase } from './containsLowercase';

describe('validators :: containsLowercase', () => {
  it('returns an error if there are no lowercase characters in the passed string', () => {
    expect(containsLowercase('test')).toEqual(undefined);
    expect(containsLowercase('Test')).toEqual(undefined);
    expect(containsLowercase('TEST')).toEqual('Must include at least one lowercase letter');
  });
});
