import { createSpacing } from './createSpacing';

describe('createSpacing', () => {
  it('Spacing function should handle 0-4 arguments', () => {
    const spacing = createSpacing();
    expect(spacing()).toBe('8px');
    expect(spacing(1)).toBe('8px');
    expect(spacing(2)).toBe('16px');
    expect(spacing(1, 2)).toBe('8px 16px');
    expect(spacing(1, 2, 3)).toBe('8px 16px 24px');
    expect(spacing(1, 2, 3, 4)).toBe('8px 16px 24px 32px');
  });
});
