import { parseCreatedByValue } from './mappers';

describe.skip('mappers', () => {
  describe('parseCreatedByValue', () => {
    it.each`
      value                        | expected
      ${''}                        | ${undefined}
      ${'api-key:1'}               | ${{ userId: 1 }}
      ${'service-account:1:admin'} | ${{ userId: 1, login: 'admin' }}
      ${'user:1:admin'}            | ${{ userId: 1, login: 'admin' }}
      ${'anonymous:0'}             | ${undefined}
      ${'render:0'}                | ${undefined}
      ${':0'}                      | ${undefined}
    `("parsing '$value' should be '$expected'", ({ value, expected }) => {
      expect(parseCreatedByValue(value)).toEqual(expected);
    });
  });
});
