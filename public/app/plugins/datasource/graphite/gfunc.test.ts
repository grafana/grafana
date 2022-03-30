import gfunc from './gfunc';

describe('gfunc', () => {
  const INDEX = {
    foo: {
      name: 'foo',
      params: [],
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
});
