import { createTheme } from '@grafana/data';
import { ExpressionQueryType, type ExpressionQuery } from 'app/features/expressions/types';

import { getExpressionSectionLabel, getHiddenMaskStyles } from './utils';

describe('getHiddenMaskStyles', () => {
  it('desaturates and applies a stronger dim in dark mode', () => {
    const styles = getHiddenMaskStyles(createTheme({ colors: { mode: 'dark' } }));

    expect(styles).toEqual({ opacity: 0.6, filter: 'grayscale(0.8)' });
  });

  it('desaturates and applies a lighter dim in light mode', () => {
    const styles = getHiddenMaskStyles(createTheme({ colors: { mode: 'light' } }));

    expect(styles).toEqual({ opacity: 0.7, filter: 'grayscale(0.8)' });
  });
});

describe('getExpressionSectionLabel', () => {
  function expressionQuery(type: ExpressionQueryType): ExpressionQuery {
    return { refId: 'A', type };
  }

  it.each([
    [ExpressionQueryType.sql, 'Sql Expression'],
    [ExpressionQueryType.math, 'Math Expression'],
    [ExpressionQueryType.threshold, 'Threshold Expression'],
  ])('capitalizes the %s expression type', (type, expected) => {
    expect(getExpressionSectionLabel(expressionQuery(type))).toBe(expected);
  });
});
