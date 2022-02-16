import {
  addOperationWithRangeVector,
  createFunction,
  createRangeFunction,
  operationWithRangeVectorRenderer,
} from './operations';
import { functionRendererLeft, functionRendererRight } from './shared/operationUtils';
import { PromVisualQueryOperationCategory } from './types';
import { QueryBuilderOperationDef } from './shared/types';

describe('Functions that create QueryBuilderOperationDef', () => {
  const checkParamsExistInQueryBuilderOperationDef = (result: QueryBuilderOperationDef) => {
    ['name', 'params', 'defaultParams', 'category', 'renderer', 'addOperationHandler'].forEach((property: string) =>
      expect(result).toHaveProperty(property)
    );
  };
  describe('createFunction', () => {
    it('Contains defaults when no other properties are passed in', () => {
      const result = createFunction({
        id: 'testid',
      });
      checkParamsExistInQueryBuilderOperationDef(result);
      expect(result.renderer).toEqual(functionRendererLeft);
      expect(result.params).toEqual([]);
      expect(result.defaultParams).toEqual([]);
      expect(result.category).toEqual(PromVisualQueryOperationCategory.Functions);
    });
    it('Defaults to functionRendererRight with params, uses params passed in', () => {
      const result = createFunction({
        id: 'testid',
        params: [{ name: 'name', type: 'string' }],
        defaultParams: [''],
        category: PromVisualQueryOperationCategory.Trigonometric,
      });
      checkParamsExistInQueryBuilderOperationDef(result);
      expect(result.renderer).toEqual(functionRendererRight);
      expect(result.category).toEqual(PromVisualQueryOperationCategory.Trigonometric);
    });
  });
  describe('createRangeFunction', () => {
    it('Creates a range function with defaults', () => {
      const result = createRangeFunction('testid');
      checkParamsExistInQueryBuilderOperationDef(result);
      expect(result.defaultParams).toEqual(['auto']);
      expect(result.category).toEqual(PromVisualQueryOperationCategory.RangeFunctions);
      expect(result.renderer).toEqual(operationWithRangeVectorRenderer);
      expect(result.addOperationHandler).toEqual(addOperationWithRangeVector);
    });
  });
});
