import { createTheme } from '@grafana/data';

import { headingBoldWeight } from './markdownHeadingStyles';

describe('headingBoldWeight', () => {
  it('uses the theme bold weight when it is already heavier than the heading', () => {
    const { typography } = createTheme();
    expect(typography.h2.fontWeight).toBe(400);
    expect(headingBoldWeight(typography.h2, typography)).toBe(typography.fontWeightBold);
  });

  it('stays heavier than headings that are as heavy as the theme bold weight', () => {
    const { typography } = createTheme({ typography: { fontWeightBold: 600, h2: { fontWeight: 600 } } });
    expect(headingBoldWeight(typography.h2, typography)).toBe(700);
  });
});
