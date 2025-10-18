import { getAggregationOperations } from './aggregations';
import { QueryBuilderOperation } from './shared/types';
import { PromOperationId } from './types';

describe('getAggregationOperations', () => {
  it('returns a list containing all aggregation IDs', () => {
    const ops = getAggregationOperations();
    const ids = ops.map((o) => o.id);

    expect(ids).toContain(PromOperationId.Sum);
    expect(ids).toContain(PromOperationId.Avg);
    expect(ids).toContain(PromOperationId.Min);
    expect(ids).toContain(PromOperationId.Max);
    expect(ids).toContain(PromOperationId.Count);
    expect(ids).toContain(PromOperationId.Group);
    expect(ids).toContain(PromOperationId.Stddev);
    expect(ids).toContain(PromOperationId.Stdvar);

    // aggregations with params
    expect(ids).toContain(PromOperationId.TopK);
    expect(ids).toContain(PromOperationId.BottomK);
    expect(ids).toContain(PromOperationId.CountValues);
    expect(ids).toContain(PromOperationId.Quantile);
    expect(ids).toContain(PromOperationId.LimitK);
    expect(ids).toContain(PromOperationId.LimitRatio);

    // over-time range aggregations
    expect(ids).toContain(PromOperationId.SumOverTime);
    expect(ids).toContain(PromOperationId.AvgOverTime);
    expect(ids).toContain(PromOperationId.MinOverTime);
    expect(ids).toContain(PromOperationId.MaxOverTime);
    expect(ids).toContain(PromOperationId.CountOverTime);
    expect(ids).toContain(PromOperationId.LastOverTime);
    expect(ids).toContain(PromOperationId.PresentOverTime);
    expect(ids).toContain(PromOperationId.AbsentOverTime);
    expect(ids).toContain(PromOperationId.StddevOverTime);
  });

  it('includes over-time range functions with correct renderer behavior', () => {
    const ops = getAggregationOperations();
    const sumOverTime = ops.find((o) => o.id === PromOperationId.SumOverTime)!;
    expect(sumOverTime).toBeDefined();
    expect(sumOverTime.params.length).toBeGreaterThan(0);

    // call renderer with default param
    const model: QueryBuilderOperation = { id: sumOverTime.id, params: sumOverTime.defaultParams };
    const rendered = sumOverTime.renderer(model, sumOverTime, 'metric');
    expect(rendered).toBe(`${PromOperationId.SumOverTime}(metric[$__interval])`);

    // call renderer with custom param
    const modelCustom: QueryBuilderOperation = { id: sumOverTime.id, params: ['5m'] };
    const renderedCustom = sumOverTime.renderer(modelCustom, sumOverTime, 'metric');
    expect(renderedCustom).toBe(`${PromOperationId.SumOverTime}(metric[5m])`);
  });
});
