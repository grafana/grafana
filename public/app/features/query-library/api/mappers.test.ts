import { parseCreatedByValue } from './mappers';

describe('mappers', () => {
  describe('parseCreatedByValue', () => {
    it.each`
      value             | expected
      ${''}             | ${undefined}
      ${'anon'}         | ${{ login: 'anonymous' }}
      ${'key:1'}        | ${{ userId: '1' }}
      ${'user:1:admin'} | ${{ userId: '1', login: 'admin' }}
      ${'sys:1:admin'}  | ${{ userId: '1', login: 'admin' }}
    `("parsing '$value' should be '$expected'", ({ value, expected }) => {
      expect(parseCreatedByValue(value)).toBe(expected);
    });
  });
});
