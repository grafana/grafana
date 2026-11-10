import { assertApiVersion } from './assertApiVersion';

describe('assertApiVersion', () => {
  it.each(['v1', 'v0alpha1', 'v1beta1'])('should accept valid API versions: %s', (apiVersion) => {
    const result = assertApiVersion(apiVersion);

    expect(result).toBeUndefined();
  });

  it.each(['', 'v1.0', 'v1/secret?x=', 'v1%2fsecret', 'v1\n'])(
    'should reject invalid API versions: %s',
    (apiVersion) => {
      expect(() => assertApiVersion(apiVersion)).toThrow('Invalid API version');
    }
  );

  it('should reject an omitted API version', () => {
    expect(() => assertApiVersion()).toThrow('Invalid API version');
  });
});
