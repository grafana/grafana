import { FuncDef, FuncDefs, FuncInstance } from '../gfunc';

import { EditableParam } from './FunctionParamEditor';
import { mapFuncDefsToSelectables, mapFuncInstanceToParams } from './helpers';

function createFunctionInstance(funcDef: FuncDef, currentParams: string[]): FuncInstance {
  let funcInstance: FuncInstance = new FuncInstance(funcDef);
  funcInstance.params = currentParams;
  return funcInstance;
}

describe('Graphite components helpers', () => {
  it('converts function definitions to selectable options', function () {
    const functionDefs: FuncDefs = {
      functionA1: { name: 'functionA1', category: 'A', params: [], defaultParams: [] },
      functionB1: { name: 'functionB1', category: 'B', params: [], defaultParams: [] },
      functionA2: { name: 'functionA2', category: 'A', params: [], defaultParams: [] },
      functionB2: { name: 'functionB2', category: 'B', params: [], defaultParams: [] },
    };
    const options = mapFuncDefsToSelectables(functionDefs);

    expect(options).toMatchObject([
      {
        label: 'A',
        options: [
          { label: 'functionA1', value: 'functionA1' },
          { label: 'functionA2', value: 'functionA2' },
        ],
      },
      {
        label: 'B',
        options: [
          { label: 'functionB1', value: 'functionB1' },
          { label: 'functionB2', value: 'functionB2' },
        ],
      },
    ]);
  });

  describe('mapFuncInstanceToParams', () => {
    let funcDef: FuncDef;

    function assertFunctionInstance(definition: FuncDef, params: string[], expected: EditableParam[]): void {
      expect(mapFuncInstanceToParams(createFunctionInstance(definition, params))).toMatchObject(expected);
    }

    it('converts param options to selectable options', () => {
      const funcDef = {
        name: 'functionA1',
        category: 'A',
        params: [{ name: 'foo', type: 'any', optional: false, multiple: false, options: ['foo', 2] }],
        defaultParams: [],
      };

      assertFunctionInstance(
        funcDef,
        [],
        [
          {
            name: 'foo',
            multiple: false,
            optional: false,
            options: [
              { label: 'foo', value: 'foo' },
              { label: '2', value: '2' },
            ],
            value: '',
          },
        ]
      );
    });

    describe('when all parameters are required and no multiple values are allowed', () => {
      beforeEach(() => {
        funcDef = {
          name: 'allRequiredNoMultiple',
          category: 'A',
          params: [
            { name: 'a', type: 'any', optional: false, multiple: false },
            { name: 'b', type: 'any', optional: false, multiple: false },
          ],
          defaultParams: [],
        };
      });

      it('creates required params', () => {
        assertFunctionInstance(
          funcDef,
          [],
          [
            { name: 'a', multiple: false, optional: false, options: [], value: '' },
            { name: 'b', multiple: false, optional: false, options: [], value: '' },
          ]
        );
      });

      it('fills in provided parameters', () => {
        assertFunctionInstance(
          funcDef,
          ['a', 'b'],
          [
            { name: 'a', multiple: false, optional: false, options: [], value: 'a' },
            { name: 'b', multiple: false, optional: false, options: [], value: 'b' },
          ]
        );
      });
    });

    describe('when all parameters are required and multiple values are allowed', () => {
      beforeEach(() => {
        funcDef = {
          name: 'allRequiredWithMultiple',
          category: 'A',
          params: [
            { name: 'a', type: 'any', optional: false, multiple: false },
            { name: 'b', type: 'any', optional: false, multiple: true },
          ],
          defaultParams: [],
        };
      });

      it('does not add extra param to add multiple values if not all params are filled in', () => {
        assertFunctionInstance(
          funcDef,
          [],
          [
            { name: 'a', multiple: false, optional: false, options: [], value: '' },
            { name: 'b', multiple: true, optional: false, options: [], value: '' },
          ]
        );

        assertFunctionInstance(
          funcDef,
          ['a'],
          [
            { name: 'a', multiple: false, optional: false, options: [], value: 'a' },
            { name: 'b', multiple: true, optional: false, options: [], value: '' },
          ]
        );
      });

      it('marks additional params as optional (only first one is required)', () => {
        assertFunctionInstance(
          funcDef,
          ['a', 'b', 'b2'],
          [
            { name: 'a', multiple: false, optional: false, options: [], value: 'a' },
            { name: 'b', multiple: true, optional: false, options: [], value: 'b' },
            { name: 'b', multiple: true, optional: true, options: [], value: 'b2' },
            { name: 'b', multiple: true, optional: true, options: [], value: '' },
          ]
        );
      });

      it('adds an extra param to allo adding multiple values if all params are filled in', () => {
        assertFunctionInstance(
          funcDef,
          ['a', 'b'],
          [
            { name: 'a', multiple: false, optional: false, options: [], value: 'a' },
            { name: 'b', multiple: true, optional: false, options: [], value: 'b' },
            { name: 'b', multiple: true, optional: true, options: [], value: '' },
          ]
        );
      });
    });

    describe('when there are optional parameters but no multiple values are allowed', () => {
      beforeEach(() => {
        funcDef = {
          name: 'twoOptionalNoMultiple',
          category: 'A',
          params: [
            { name: 'a', type: 'any', optional: false, multiple: false },
            { name: 'b', type: 'any', optional: false, multiple: false },
            { name: 'c', type: 'any', optional: true, multiple: false },
            { name: 'd', type: 'any', optional: true, multiple: false },
          ],
          defaultParams: [],
        };
      });

      it('creates non-required parameters', () => {
        assertFunctionInstance(
          funcDef,
          [],
          [
            { name: 'a', multiple: false, optional: false, options: [], value: '' },
            { name: 'b', multiple: false, optional: false, options: [], value: '' },
            { name: 'c', multiple: false, optional: true, options: [], value: '' },
            { name: 'd', multiple: false, optional: true, options: [], value: '' },
          ]
        );
      });

      it('fills in provided parameters', () => {
        assertFunctionInstance(
          funcDef,
          ['a', 'b', 'c', 'd'],
          [
            { name: 'a', multiple: false, optional: false, options: [], value: 'a' },
            { name: 'b', multiple: false, optional: false, options: [], value: 'b' },
            { name: 'c', multiple: false, optional: true, options: [], value: 'c' },
            { name: 'd', multiple: false, optional: true, options: [], value: 'd' },
          ]
        );
      });
    });

    describe('when there are optional parameters and multiple values are allowed', () => {
      beforeEach(() => {
        funcDef = {
          name: 'twoOptionalWithMultiple',
          category: 'A',
          params: [
            { name: 'a', type: 'any', optional: false, multiple: false },
            { name: 'b', type: 'any', optional: false, multiple: false },
            { name: 'c', type: 'any', optional: true, multiple: false },
            { name: 'd', type: 'any', optional: true, multiple: true },
          ],
          defaultParams: [],
        };
      });

      it('does not add extra param to add multiple values if not all params are filled in', () => {
        assertFunctionInstance(
          funcDef,
          ['a', 'b', 'c'],
          [
            { name: 'a', multiple: false, optional: false, options: [], value: 'a' },
            { name: 'b', multiple: false, optional: false, options: [], value: 'b' },
            { name: 'c', multiple: false, optional: true, options: [], value: 'c' },
            { name: 'd', multiple: true, optional: true, options: [], value: '' },
          ]
        );
      });

      it('adds an extra param to add multiple values if all params are filled in', () => {
        assertFunctionInstance(
          funcDef,
          ['a', 'b', 'c', 'd'],
          [
            { name: 'a', multiple: false, optional: false, options: [], value: 'a' },
            { name: 'b', multiple: false, optional: false, options: [], value: 'b' },
            { name: 'c', multiple: false, optional: true, options: [], value: 'c' },
            { name: 'd', multiple: true, optional: true, options: [], value: 'd' },
            { name: 'd', multiple: true, optional: true, options: [], value: '' },
          ]
        );
      });
    });
  });
});
