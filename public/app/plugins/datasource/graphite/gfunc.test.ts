import gfunc, { FuncDefs, FuncInstance } from './gfunc';

describe('gfunc', () => {
  const INDEX: FuncDefs = {
    foo: {
      name: 'foo',
      params: [],
      defaultParams: [],
    },
  };

  it('returns function from the index', () => {
    expect(gfunc.getFuncDef('foo', INDEX)).toEqual(INDEX.foo);
  });

  it('marks function as unknown when it is not available in the index', () => {
    expect(gfunc.getFuncDef('bar', INDEX)).toEqual({
      name: 'bar',
      params: [{ name: '', type: '', multiple: true }],
      defaultParams: [''],
      unknown: true,
    });
  });

  it('renders the version < .9 asPercent function parameters by not escaping them as a string', () => {
    // this function is returned from the graphite functions endpoint
    const asPercentDef = {
      name: 'asPercent',
      description: 'Calculates a percentage.',
      category: 'Combine',
      params: [
        {
          name: 'total',
          type: 'string',
          optional: true,
          multiple: false,
        },
        {
          name: 'nodes',
          type: 'node_or_tag',
          optional: true,
          multiple: true,
          options: [],
        },
      ],
      defaultParams: [],
    };

    const asPercent = new FuncInstance(asPercentDef);

    const asPercentRendered = asPercent.render('#A', () => '#A');

    expect(asPercentRendered).toEqual('asPercent(#A)');
  });
});
