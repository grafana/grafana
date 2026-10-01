import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import { FieldType, type InterpolateFunction, toDataFrame } from '@grafana/data';

import { buildAllRowsContext, buildRows, compileTemplate, type TemplateContext } from './handlebars';

const hosts = toDataFrame({
  name: 'frameA',
  refId: 'A',
  fields: [
    { name: 'host', type: FieldType.string, values: ['web-1', 'web-2'] },
    { name: 'cpu', type: FieldType.number, values: [0.84, 0.12] },
  ],
});

const empty = toDataFrame({
  name: 'frameB',
  refId: 'B',
  fields: [{ name: 'host', type: FieldType.string, values: [] }],
});

function createReplaceVariables(variables: unknown[] = []): InterpolateFunction {
  const templateSrv = initTemplateSrv('hello', variables);
  return (target, scopedVars, format) => templateSrv.replace(target, scopedVars, format);
}

function render(content: string, context: TemplateContext = {}, replaceVariables = createReplaceVariables()) {
  return compileTemplate(content, replaceVariables)(context);
}

/** A frame whose display processor adds a unit, as applyFieldOverrides would. */
function withUnit() {
  const frame = toDataFrame({
    fields: [{ name: 'cpu', type: FieldType.number, values: [0.84, 0.12], config: { unit: 'percentunit' } }],
  });
  frame.fields[0].display = (value) => ({ text: String(Number(value) * 100), numeric: Number(value), suffix: '%' });

  return frame;
}

describe('buildRows', () => {
  it('builds one plain object per row, keyed by field name', () => {
    expect(buildRows(hosts, [hosts])).toEqual([
      { host: 'web-1', cpu: 0.84, fmt: { host: 'web-1', cpu: '0.84' } },
      { host: 'web-2', cpu: 0.12, fmt: { host: 'web-2', cpu: '0.12' } },
    ]);
  });

  it('keeps unit fields raw, with the formatted value under `fmt`', () => {
    const frame = withUnit();

    expect(buildRows(frame, [frame])).toEqual([
      { cpu: 0.84, fmt: { cpu: '84%' } },
      { cpu: 0.12, fmt: { cpu: '12%' } },
    ]);
  });

  it('lets a field named `fmt` shadow the namespace rather than being hidden by it', () => {
    const frame = toDataFrame({ fields: [{ name: 'fmt', type: FieldType.string, values: ['mine'] }] });

    expect(buildRows(frame, [frame])).toEqual([{ fmt: 'mine' }]);
  });

  it('returns an empty array for a frame with no rows', () => {
    expect(buildRows(empty, [empty])).toEqual([]);
  });

  it('builds at most maxRows rows', () => {
    expect(buildRows(hosts, [hosts], 1)).toEqual([{ host: 'web-1', cpu: 0.84, fmt: { host: 'web-1', cpu: '0.84' } }]);
    expect(buildRows(hosts, [hosts], 0)).toEqual([]);
    expect(buildRows(hosts, [hosts], -1)).toEqual([]);
  });
});

describe('buildAllRowsContext', () => {
  it('exposes every frame, and the first one with rows as `data`', () => {
    const context = buildAllRowsContext([empty, hosts]);

    expect(context.data).toEqual(buildRows(hosts, [empty, hosts]));
    expect(context.frames).toEqual([
      { name: 'frameB', refId: 'B', data: [] },
      { name: 'frameA', refId: 'A', data: buildRows(hosts, [empty, hosts]) },
    ]);
  });

  it('leaves `data` empty when there is nothing to render', () => {
    expect(buildAllRowsContext([])).toEqual({ data: [], frames: [] });
  });

  it('spends maxRows across the frames rather than per frame', () => {
    const context = buildAllRowsContext([hosts, hosts], 3);

    expect(context.frames.map((frame) => frame.data.length)).toEqual([2, 1]);
  });
});

describe('compileTemplate', () => {
  it('leaves content without expressions untouched', () => {
    expect(render('# Title')).toBe('# Title');
  });

  it('resolves an expression against the context', () => {
    expect(render('{{host}}', { host: 'web-1' })).toBe('web-1');
  });

  it('iterates rows', () => {
    expect(render('{{#each data}}{{host}},{{/each}}', buildAllRowsContext([hosts]))).toBe('web-1,web-2,');
  });

  it('HTML-escapes by default, and does not for triple braces', () => {
    expect(render('{{host}}', { host: '<b>x</b>' })).toBe('&lt;b&gt;x&lt;/b&gt;');
    expect(render('{{{host}}}', { host: '<b>x</b>' })).toBe('<b>x</b>');
  });

  describe('helpers', () => {
    it.each([
      ['and true', '{{#if (and a b)}}y{{/if}}', { a: true, b: true }, 'y'],
      ['and false', '{{#if (and a b)}}y{{/if}}', { a: true, b: false }, ''],
      ['and reads every argument', '{{#if (and a b c)}}y{{/if}}', { a: true, b: true, c: false }, ''],
      ['or', '{{#if (or a b)}}y{{/if}}', { a: false, b: true }, 'y'],
      ['or reads every argument', '{{#if (or a b c)}}y{{/if}}', { a: false, b: false, c: true }, 'y'],
      ['not', '{{#if (not a)}}y{{/if}}', { a: false }, 'y'],
      ['eq', '{{#if (eq a "x")}}y{{/if}}', { a: 'x' }, 'y'],
      ['unlessEq', '{{#if (unlessEq a "x")}}y{{/if}}', { a: 'z' }, 'y'],
      ['gt', '{{#if (gt a 2)}}y{{/if}}', { a: 3 }, 'y'],
      ['gte', '{{#if (gte a 3)}}y{{/if}}', { a: 3 }, 'y'],
      ['lt', '{{#if (lt a 2)}}y{{/if}}', { a: 1 }, 'y'],
      ['lte', '{{#if (lte a 1)}}y{{/if}}', { a: 1 }, 'y'],
      ['contains on an array', '{{#if (contains a "x")}}y{{/if}}', { a: ['x', 'z'] }, 'y'],
      ['contains on a string', '{{#if (contains a "ell")}}y{{/if}}', { a: 'hello' }, 'y'],
      ['startsWith', '{{#if (startsWith a "he")}}y{{/if}}', { a: 'hello' }, 'y'],
      ['endsWith', '{{#if (endsWith a "lo")}}y{{/if}}', { a: 'hello' }, 'y'],
      ['match', '{{#if (match a "^web-")}}y{{/if}}', { a: 'web-1' }, 'y'],
      ['split + join', '{{join (split a ",") "|"}}', { a: 'a,b' }, 'a|b'],
      ['split + join without separators', '{{join (split a)}}', { a: 'a,b' }, 'a,b'],
      ['toFixed', '{{toFixed a 2}}', { a: 1.234 }, '1.23'],
      ['toFixed without digits', '{{toFixed a}}', { a: 1.234 }, '1.234'],
      ['toFixed on a non-number', '{{toFixed a 2}}', { a: 'n/a' }, 'n/a'],
      ['json', '{{{json a}}}', { a: { b: 1 } }, '{\n  "b": 1\n}'],
    ])('%s', (_name, content, context, expected) => {
      expect(render(content, context)).toBe(expected);
    });

    // Handlebars counts an empty array and 0 as falsy, so `(and data …)` has to as well.
    it.each([
      ['an empty array', []],
      ['zero', 0],
    ])('agrees with `#if` on %s', (_name, value) => {
      const inIf = render('{{#if a}}y{{else}}n{{/if}}', { a: value });

      expect(render('{{#if (and a)}}y{{else}}n{{/if}}', { a: value })).toBe(inIf);
      expect(render('{{#if (or a)}}y{{else}}n{{/if}}', { a: value })).toBe(inIf);
      expect(render('{{#if (not a)}}y{{else}}n{{/if}}', { a: value })).toBe('y');
    });

    it('compares unit fields, and prints them formatted through `fmt`', () => {
      const frame = withUnit();
      const context = buildAllRowsContext([frame]);

      expect(render('{{#each data}}{{#if (gt cpu 0.5)}}[{{fmt.cpu}}]{{/if}}{{/each}}', context)).toBe('[84%]');
    });

    it('formats dates', () => {
      expect(render('{{date a "YYYY-MM-DD"}}', { a: '2026-08-11T10:00:00Z' })).toBe('2026-08-11');
    });

    it('renders now for `date` with no argument, and nothing for a value that is not a date', () => {
      expect(render('{{date}}')).not.toBe('');
      expect(render('{{date a}}', { a: null })).toBe('');
      expect(render('{{date a}}', { a: '' })).toBe('');
      expect(render('{{date missing}}')).toBe('');
    });

    it('reads a dashboard variable as a value and as a list', () => {
      const replaceVariables = createReplaceVariables([
        {
          type: 'custom',
          name: 'env',
          current: { value: ['dev', 'prod'], text: ['dev', 'prod'] },
          options: [
            { value: 'dev', text: 'dev', selected: true },
            { value: 'prod', text: 'prod', selected: true },
          ],
          multi: true,
        },
      ]);

      expect(render('{{#each (variable "env")}}[{{this}}]{{/each}}', {}, replaceVariables)).toBe('[dev][prod]');
      expect(render('{{variableValue "env"}}', {}, replaceVariables)).toBe('{dev,prod}');
    });
  });

  describe('errors', () => {
    it('throws on a syntax error, at compile time', () => {
      expect(() => compileTemplate('{{#if a}}no close', createReplaceVariables())).toThrow();
    });

    it('throws on a runtime error', () => {
      expect(() => render('{{nope a}}', { a: 1 })).toThrow();
    });
  });
});
