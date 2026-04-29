import { ensureStringValues } from './ensureStringValues';

describe('ensureStringValues', () => {
  it.each`
    value              | expected
    ${null}            | ${''}
    ${undefined}       | ${''}
    ${{}}              | ${''}
    ${{ current: {} }} | ${''}
    ${1}               | ${'1'}
    ${[1, 2]}          | ${['1', '2']}
    ${'1'}             | ${'1'}
    ${['1', '2']}      | ${['1', '2']}
    ${true}            | ${'true'}
  `('when called with value:$value then result should be:$expected', ({ value, expected }) => {
    expect(ensureStringValues(value)).toEqual(expected);
  });
});
