import { getOperationDefinitions, addOperationWithRangeVector } from './operations';
import { QueryBuilderOperation, VisualQueryModeller } from './shared/types';
import { PromOperationId, PromVisualQuery } from './types';

describe('getOperationDefinitions', () => {
  it('returns a list containing operation IDs', () => {
    const ops = getOperationDefinitions();
    const ids = ops.map((o) => o.id);

    expect(ids).toContain(PromOperationId.HistogramQuantile);
    expect(ids).toContain(PromOperationId.Rate);
    expect(ids).toContain(PromOperationId.PredictLinear);
    expect(ids).toContain(PromOperationId.QuantileOverTime);
    expect(ids).toContain(PromOperationId.LabelJoin);
    expect(ids).toContain(PromOperationId.Vector);
  });

  it('range function renderer uses default and custom range vector params', () => {
    const ops = getOperationDefinitions();
    const rate = ops.find((o) => o.id === PromOperationId.Rate)!;

    expect(rate).toBeDefined();

    const modelDefault: QueryBuilderOperation = { id: rate.id, params: rate.defaultParams };
    const renderedDefault = rate.renderer(modelDefault, rate, 'metric');
    expect(renderedDefault).toBe(`${PromOperationId.Rate}(metric[$__rate_interval])`);

    const modelCustom: QueryBuilderOperation = { id: rate.id, params: ['5m'] };
    const renderedCustom = rate.renderer(modelCustom, rate, 'metric');
    expect(renderedCustom).toBe(`${PromOperationId.Rate}(metric[5m])`);
  });

  it('changeTypeHandler updates operation params when rate/interval default changes', () => {
    const ops = getOperationDefinitions();
    const doubleExp = ops.find((o) => o.id === PromOperationId.DoubleExponentialSmoothing)!;
    expect(doubleExp).toBeDefined();
    // simulate an operation currently using $__rate_interval
    const operation: QueryBuilderOperation = { id: doubleExp.id, params: ['$__rate_interval'] };

    // create a new definition that uses $__interval instead
    const newDef = { ...doubleExp, defaultParams: ['$__interval'] };

    if (doubleExp.changeTypeHandler) {
      const updated = doubleExp.changeTypeHandler(operation, newDef);
      expect(updated.params).toEqual(newDef.defaultParams);
    }
  });

  it('addOperationWithRangeVector inserts a range op at the front of the query', () => {
    const ops = getOperationDefinitions();
    const changes = ops.find((o) => o.id === PromOperationId.Changes)!;
    const query: PromVisualQuery = { operations: [], metric: 'metric', labels: [] };
    const modeller = {} as VisualQueryModeller;

    const result = addOperationWithRangeVector(changes, query, modeller);
    expect(result.operations[0].id).toBe(changes.id);
  });

  it('vector renderer renders parameter as value', () => {
    const ops = getOperationDefinitions();
    const vector = ops.find((o) => o.id === PromOperationId.Vector)!;
    expect(vector).toBeDefined();

    const model: QueryBuilderOperation = { id: vector.id, params: [42] };
    const rendered = vector.renderer(model, vector, '');
    expect(rendered).toBe(`${PromOperationId.Vector}(42)`);
  });
});
