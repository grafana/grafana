import { defaultAxisTextWidthForCanvasTests } from './measureText';

describe('defaultAxisTextWidthForCanvasTests', () => {
  it('scales with character count and font size', () => {
    expect(defaultAxisTextWidthForCanvasTests('ab', 12)).toBe(14.4);
    expect(defaultAxisTextWidthForCanvasTests('ab', 24)).toBe(28.8);
  });

  it('enforces a minimum width', () => {
    expect(defaultAxisTextWidthForCanvasTests('', 12)).toBe(8);
    expect(defaultAxisTextWidthForCanvasTests(null, 12)).toBe(8);
  });
});
