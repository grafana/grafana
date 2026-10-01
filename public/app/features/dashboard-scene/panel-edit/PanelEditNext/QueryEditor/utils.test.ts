import { createTheme, DataTopic, type DataTransformerConfig } from '@grafana/data';
import { type CustomTransformOperator } from '@grafana/scenes';
import { ExpressionQueryType, type ExpressionQuery } from 'app/features/expressions/types';

import { filterDataTransformerConfigs, getExpressionSectionLabel, getHiddenMaskStyles } from './utils';

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
    [ExpressionQueryType.sql, 'SQL Expression'],
    [ExpressionQueryType.math, 'Math Expression'],
    [ExpressionQueryType.threshold, 'Threshold Expression'],
    [ExpressionQueryType.classic, 'Classic condition (legacy) Expression'],
  ])('uses the human-readable name for the %s expression type', (type, expected) => {
    expect(getExpressionSectionLabel(expressionQuery(type))).toBe(expected);
  });

  it('falls back to the raw type when it is not a known expression type', () => {
    // Reachable at runtime: isExpressionQuery narrows on the __expr__ datasource ref alone, so a
    // query can be treated as an expression while carrying a type outside the enum.
    const query = { refId: 'A', type: 'custom_thing' } as unknown as ExpressionQuery;

    expect(getExpressionSectionLabel(query)).toBe('Custom_thing Expression');
  });
});

describe('filterDataTransformerConfigs', () => {
  it('keeps a transformation config that carries a user-set refId', () => {
    const named: DataTransformerConfig = { id: 'reduce', refId: 'T-A', options: {} };
    const unnamed: DataTransformerConfig = { id: 'groupBy', options: {} };

    expect(filterDataTransformerConfigs([named, unnamed])).toEqual([named, unnamed]);
  });

  it('drops the custom transformer definitions the UI cannot render', () => {
    const operator: CustomTransformOperator = () => (source) => source;
    const organize: DataTransformerConfig = { id: 'organize', options: {} };

    expect(filterDataTransformerConfigs([operator, { operator, topic: DataTopic.Annotations }, organize])).toEqual([
      organize,
    ]);
  });
});
