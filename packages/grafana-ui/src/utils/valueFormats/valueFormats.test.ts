import { getValueFormat } from './valueFormats';

describe('dynamic formats', () => {
  it('should support fixed', () => {
    const fmt = getValueFormat('fixed:pastries/person');
    expect(fmt(20)).toBe('20 pastries/person');
  });

  it('should support fixed', () => {
    const fmt = getValueFormat('moment:dddd');
    expect(fmt(1505634997920)).toBe('Sunday');
  });
});
