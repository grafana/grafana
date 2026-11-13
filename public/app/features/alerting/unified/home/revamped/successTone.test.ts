import { getChannelTone, getSuccessTone } from './successTone';

describe('getSuccessTone', () => {
  it.each`
    share     | tone
    ${1}      | ${'success'}
    ${0.995}  | ${'success'}
    ${0.9949} | ${'warning'}
    ${0.99}   | ${'warning'}
    ${0.9899} | ${'error'}
    ${0.5}    | ${'error'}
  `('paints a $share success share as $tone', ({ share, tone }) => {
    expect(getSuccessTone(share)).toBe(tone);
  });

  it('stays neutral when there is nothing to measure yet', () => {
    expect(getSuccessTone(undefined)).toBe('neutral');
  });
});

describe('getChannelTone', () => {
  it.each`
    share     | tone
    ${1}      | ${'success'}
    ${0.995}  | ${'success'}
    ${0.9949} | ${'warning'}
    ${0.98}   | ${'warning'}
    ${0.9799} | ${'error'}
    ${0.5}    | ${'error'}
    ${0}      | ${'error'}
  `('paints a $share success share as $tone', ({ share, tone }) => {
    expect(getChannelTone(share)).toBe(tone);
  });

  it('stays neutral when the channel has no attempts to judge', () => {
    expect(getChannelTone(undefined)).toBe('neutral');
  });
});
