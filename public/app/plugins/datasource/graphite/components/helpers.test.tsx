import { mapFuncDefsToSelectables } from './helpers';
import { FuncDefs } from '../gfunc';

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
});
