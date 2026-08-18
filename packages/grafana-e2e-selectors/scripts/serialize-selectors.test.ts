import { serializeSelectorGroup } from './serialize-selectors';

const MIN = '8.0.0';

describe('serializeSelectorGroup', () => {
  it('keeps plain string selectors as-is and preserves version keys', () => {
    const result = serializeSelectorGroup({
      Group: {
        versioned: { '9.4.0': 'new value', [MIN]: 'old value' },
      },
    });

    expect(result).toEqual({
      Group: {
        versioned: { '9.4.0': 'new value', [MIN]: 'old value' },
      },
    });
  });

  it('serializes a zero-arg (css) function to an empty-params template', () => {
    const result = serializeSelectorGroup({
      Group: { css: { [MIN]: () => '.some-class' } },
    });

    expect(result).toEqual({
      Group: { css: { [MIN]: { $template: '.some-class', params: [] } } },
    });
  });

  it('serializes a one-arg function to a named template descriptor', () => {
    const result = serializeSelectorGroup({
      Group: { one: { [MIN]: (value: string) => `data-testid option ${value}` } },
    });

    expect(result).toEqual({
      Group: { one: { [MIN]: { $template: 'data-testid option {value}', params: ['value'] } } },
    });
  });

  it('serializes a two-arg function with named placeholders', () => {
    const result = serializeSelectorGroup({
      Group: { two: { '13.2.0': (from: string, to: string) => `range ${from} to ${to}` } },
    });

    expect(result).toEqual({
      Group: { two: { '13.2.0': { $template: 'range {from} to {to}', params: ['from', 'to'] } } },
    });
  });

  it('serializes a function with more parameters than the legacy sentinel count', () => {
    const result = serializeSelectorGroup({
      Group: {
        many: { '13.2.0': (a: string, b: string, c: string, d: string, e: string) => `${a}-${b}-${c}-${d}-${e}` },
      },
    });

    expect(result).toEqual({
      Group: { many: { '13.2.0': { $template: '{a}-{b}-{c}-{d}-{e}', params: ['a', 'b', 'c', 'd', 'e'] } } },
    });
  });

  it('serializes a function that ignores its argument (no placeholder in template)', () => {
    const result = serializeSelectorGroup({
      Group: { ignores: { [MIN]: (_: string) => 'Panel status' } },
    });

    expect(result).toEqual({
      Group: { ignores: { [MIN]: { $template: 'Panel status', params: ['_'] } } },
    });
  });

  it('serializes a conditional (present/absent) function to a two-branch descriptor', () => {
    const result = serializeSelectorGroup({
      Group: {
        cond: {
          '11.1.0': (title?: string) => (title ? `Options group ${title}` : 'Options group'),
        },
      },
    });

    expect(result).toEqual({
      Group: {
        cond: {
          '11.1.0': {
            $template: { whenPresent: 'Options group {title}', whenAbsent: 'Options group' },
            params: ['title'],
          },
        },
      },
    });
  });

  it('recurses through nested selector groups', () => {
    const result = serializeSelectorGroup({
      Outer: { Inner: { deep: { [MIN]: (id: string) => `x ${id}` } } },
    });

    expect(result).toEqual({
      Outer: { Inner: { deep: { [MIN]: { $template: 'x {id}', params: ['id'] } } } },
    });
  });
});
