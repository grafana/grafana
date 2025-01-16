import { VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../shared';

import { CommonQueryInfoParams, generateCommonAutoQueryInfo } from './common';

describe('generateCommonAutoQueryInfo', () => {
  const params: CommonQueryInfoParams = {
    description: 'Test Description',
    mainQueryExpr: 'rate(test_metric[5m])',
    breakdownQueryExpr: 'sum by (label) (test_metric)',
    unit: 'short',
  };

  it('should generate a valid AutoQueryInfo object with main, preview, and breakdown variants', () => {
    const result = generateCommonAutoQueryInfo(params);

    expect(result).toHaveProperty('main');
    expect(result).toHaveProperty('preview');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('variants');
  });

  it('should configure the main variant correctly', () => {
    const result = generateCommonAutoQueryInfo(params);

    const { main } = result;
    expect(main).toMatchObject({
      title: params.description,
      unit: params.unit,
      queries: [
        {
          refId: 'A',
          expr: params.mainQueryExpr,
          legendFormat: params.description,
        },
      ],
      variant: 'main',
    });
  });

  it('should configure the preview variant correctly', () => {
    const result = generateCommonAutoQueryInfo(params);

    const { preview } = result;
    expect(preview).toMatchObject({
      title: VAR_METRIC_EXPR,
      unit: params.unit,
      queries: [
        {
          refId: 'A',
          expr: params.mainQueryExpr,
          legendFormat: params.description,
        },
      ],
      variant: 'preview',
    });
  });

  it('should configure the breakdown variant correctly', () => {
    const result = generateCommonAutoQueryInfo(params);

    const { breakdown } = result;
    expect(breakdown).toMatchObject({
      title: VAR_METRIC_EXPR,
      unit: params.unit,
      queries: [
        {
          refId: 'A',
          expr: params.breakdownQueryExpr,
          legendFormat: `{{${VAR_GROUP_BY_EXP}}}`,
        },
      ],
      variant: 'breakdown',
    });
  });

  it('should return an empty variants array', () => {
    const result = generateCommonAutoQueryInfo(params);
    expect(result.variants).toEqual([]);
  });
});
