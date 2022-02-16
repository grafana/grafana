import { createFunction } from '../operations';
import {
  functionRendererLeft,
  functionRendererRight,
  rangeRendererLeftWithParams,
  rangeRendererRightWithParams,
} from './operationUtils';
import { QueryBuilderOperationDef } from './types';

describe('Render functions', () => {
  describe('functionRendererLeft', () => {
    it('renders a simple expression', () => {
      const result = functionRendererLeft({ id: 'testid', params: [] }, {} as QueryBuilderOperationDef, 'testExpr');
      expect(result).toEqual('testid(testExpr)');
    });
    it('renders a simple expression with params', () => {
      const result = functionRendererLeft(
        { id: 'testid', params: ['one', 2] },
        createFunction({
          id: 'testfunc',
          params: [
            { name: 'first', type: 'string' },
            { name: 'second', type: 'number' },
          ],
          defaultParams: ['two', 1],
        }),
        'testExpr'
      );
      expect(result).toEqual('testid("one", 2, testExpr)');
    });
  });
  describe('functionRendererRight', () => {
    it('renders a simple expression', () => {
      const result = functionRendererRight({ id: 'testid', params: [] }, {} as QueryBuilderOperationDef, 'testExpr');
      expect(result).toEqual('testid(testExpr)');
    });
    it('renders a simple expression with params', () => {
      const result = functionRendererRight(
        { id: 'testid', params: ['one', 2] },
        createFunction({
          id: 'testfunc',
          params: [
            { name: 'first', type: 'string' },
            { name: 'second', type: 'number' },
          ],
          defaultParams: ['two', 1],
        }),
        'testExpr'
      );
      expect(result).toEqual('testid(testExpr, "one", 2)');
    });
  });
  describe('rangeRendererLeftWithParams', () => {
    it('renders a range vector left with params', () => {
      const result = rangeRendererLeftWithParams(
        { id: 'testid', params: ['auto', 'one', 2] },
        createFunction({
          id: 'testfunc',
          params: [
            { name: 'range', type: 'string' },
            { name: 'first', type: 'string' },
            { name: 'second', type: 'number' },
          ],
          defaultParams: ['auto', 'two', 1],
        }),
        'testExpr'
      );
      expect(result).toEqual('testid("one", 2, testExpr[$__rate_interval])');
    });
  });
  describe('rangeRendererRightWithParams', () => {
    it('renders a range vector right with params', () => {
      const result = rangeRendererRightWithParams(
        { id: 'testid', params: ['auto', 'one', 2] },
        createFunction({
          id: 'testfunc',
          params: [
            { name: 'range', type: 'string' },
            { name: 'first', type: 'string' },
            { name: 'second', type: 'number' },
          ],
          defaultParams: ['auto', 'two', 1],
        }),
        'testExpr'
      );
      expect(result).toEqual('testid(testExpr[$__rate_interval], "one", 2)');
    });
  });
});
