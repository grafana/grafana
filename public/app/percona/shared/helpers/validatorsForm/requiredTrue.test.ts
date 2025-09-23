import { requiredTrue } from './requiredTrue';

describe('validators :: requiredTrue', () => {
  it('returns an error if the input is false', () => {
    expect(requiredTrue(true)).toEqual(undefined);
    expect(requiredTrue(false)).toEqual('Required field');
  });
});
