import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import {
  type DataFrame,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  type InterpolateFunction,
  toDataFrame,
} from '@grafana/data';

import { buildAllRowsContext, buildRows, compileTemplate, type TemplateContext, type TemplateRow } from './handlebars';

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

describe('lazy `fmt`', () => {
  // The eager build `buildRows` replaced, kept to check the lazy one renders the same.
  function buildRowsEagerly(frame: DataFrame, series: DataFrame[]): TemplateRow[] {
    const names = frame.fields.map((field) => getFieldDisplayName(field, frame, series));

    return Array.from({ length: frame.length }, (_, rowIndex) => {
      const formatted: TemplateRow = {};
      const row: TemplateRow = { fmt: formatted };

      frame.fields.forEach((field, fieldIndex) => {
        const value = field.values[rowIndex];
        formatted[names[fieldIndex]] = field.display
          ? formattedValueToString(field.display(value))
          : String(value ?? '');
        row[names[fieldIndex]] = value;
      });

      return row;
    });
  }

  /** Counts display processor calls per field name. */
  function withCountedDisplay(frame: DataFrame) {
    const calls: Record<string, number> = {};

    for (const field of frame.fields) {
      calls[field.name] = 0;
      field.display = (value) => {
        calls[field.name]++;
        return { text: `<${String(value)}>`, numeric: Number(value), suffix: ' u' };
      };
    }

    return { frame, calls };
  }

  function counted() {
    return withCountedDisplay(
      toDataFrame({
        fields: [
          { name: 'host', type: FieldType.string, values: ['web-1', 'web-2'] },
          { name: 'cpu', type: FieldType.number, values: [0.84, 0.12] },
          { name: 'mem', type: FieldType.number, values: [512, 256] },
        ],
      })
    );
  }

  it('formats nothing for a template that reads raw values only', () => {
    const { frame, calls } = counted();

    expect(render('{{#each data}}{{host}} {{cpu}};{{/each}}', buildAllRowsContext([frame]))).toBe(
      'web-1 0.84;web-2 0.12;'
    );
    expect(calls).toEqual({ host: 0, cpu: 0, mem: 0 });
  });

  it('formats nothing when building rows', () => {
    const { frame, calls } = counted();

    buildRows(frame, [frame]);

    expect(calls).toEqual({ host: 0, cpu: 0, mem: 0 });
  });

  it('formats only the field a template reads, once per row', () => {
    const { frame, calls } = counted();

    expect(render('{{#each data}}{{fmt.cpu}}|{{fmt.cpu}};{{/each}}', buildAllRowsContext([frame]))).toBe(
      '&lt;0.84&gt; u|&lt;0.84&gt; u;&lt;0.12&gt; u|&lt;0.12&gt; u;'
    );
    expect(calls).toEqual({ host: 0, cpu: 2, mem: 0 });
  });

  it('formats only the rows a template reads', () => {
    const { frame, calls } = counted();

    expect(render('{{data.[1].fmt.mem}}', buildAllRowsContext([frame]))).toBe('&lt;256&gt; u');
    expect(calls).toEqual({ host: 0, cpu: 0, mem: 1 });
  });

  it('keeps the same `fmt` object and value across reads', () => {
    const { frame, calls } = counted();
    const [row] = buildRows(frame, [frame]);
    const formatted = row.fmt;

    expect(row.fmt).toBe(formatted);
    expect((formatted as TemplateRow).cpu).toBe('<0.84> u');
    expect((formatted as TemplateRow).cpu).toBe('<0.84> u');
    expect(calls.cpu).toBe(1);
  });

  it('leaves `fmt` a plain property once read', () => {
    const { frame } = counted();
    const [row] = buildRows(frame, [frame]);
    const [eager] = buildRowsEagerly(frame, [frame]);

    expect(row.fmt).toEqual(eager.fmt);
    expect(Object.getOwnPropertyDescriptor(row, 'fmt')).toEqual(Object.getOwnPropertyDescriptor(eager, 'fmt'));
  });

  it('lets `fmt` and its fields be overwritten, like plain properties', () => {
    const { frame } = counted();
    const [row] = buildRows(frame, [frame]);
    const [other] = buildRows(frame, [frame]);

    (other.fmt as TemplateRow).cpu = 'mine';
    row.fmt = 'replaced';

    expect(row.fmt).toBe('replaced');
    expect((other.fmt as TemplateRow).cpu).toBe('mine');
  });

  it('formats the rows of a window that does not start at the first row', () => {
    const { frame, calls } = counted();

    expect(render('{{#each data}}{{fmt.host}};{{/each}}', { data: buildRows(frame, [frame], 1, 1) })).toBe(
      '&lt;web-2&gt; u;'
    );
    expect(calls).toEqual({ host: 1, cpu: 0, mem: 0 });
  });

  it('formats a field without a display processor as text', () => {
    const frame = toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [1, null] }] });

    expect(render('{{#each data}}[{{fmt.cpu}}]{{/each}}', { data: buildRows(frame, [frame]) })).toBe('[1][]');
  });

  it('surfaces a display processor error when the template reads the field', () => {
    const frame = toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [1] }] });
    frame.fields[0].display = () => {
      throw new Error('broken processor');
    };
    const context = buildAllRowsContext([frame]);

    expect(render('{{#each data}}{{cpu}}{{/each}}', context)).toBe('1');
    expect(() => render('{{#each data}}{{fmt.cpu}}{{/each}}', context)).toThrow('broken processor');
  });

  describe('renders the same as building `fmt` eagerly', () => {
    const frame = () =>
      withCountedDisplay(
        toDataFrame({
          fields: [
            { name: 'host', type: FieldType.string, values: ['<b>web-1</b>', 'web-"2"'] },
            { name: 'cpu', type: FieldType.number, values: [0.84, null] },
            { name: 'fmt', type: FieldType.string, values: ['own fmt', 'own fmt 2'] },
            { name: 'toString', type: FieldType.string, values: ['t1', 't2'] },
            { name: 'constructor', type: FieldType.string, values: ['c1', 'c2'] },
            { name: '__proto__', type: FieldType.string, values: ['p1', 'p2'] },
            { name: 'with space', type: FieldType.number, values: [1, 2] },
            { name: '0', type: FieldType.number, values: [3, 4] },
          ],
        })
      ).frame;

    const withoutFmtField = () => {
      const built = frame();
      built.fields = built.fields.filter((field) => field.name !== 'fmt');
      return built;
    };

    const duplicateNames = () =>
      withCountedDisplay(
        toDataFrame({
          fields: [
            { name: 'cpu', type: FieldType.number, values: [1, 2], config: { displayName: 'cpu' } },
            { name: 'host', type: FieldType.string, values: ['a', 'b'] },
            { name: 'cpu', type: FieldType.number, values: [3, 4], config: { displayName: 'cpu' } },
          ],
        })
      ).frame;

    it.each([
      ['every formatted value', '{{#each data}}{{#each fmt}}{{@key}}={{this}};{{/each}}{{/each}}'],
      ['triple braces', '{{#each data}}{{{fmt.host}}}|{{{fmt.[with space]}}};{{/each}}'],
      ['double braces', '{{#each data}}{{fmt.host}}|{{fmt.cpu}}|{{fmt.[0]}};{{/each}}'],
      ['odd field names', '{{#each data}}{{fmt.toString}}|{{fmt.constructor}}|{{fmt.__proto__}};{{/each}}'],
      ['a row as JSON', '{{#each data}}{{{json this}}}{{/each}}'],
      ['every key of a row', '{{#each data}}{{#each this}}{{@key}},{{/each}};{{/each}}'],
      ['a lookup', '{{#each data}}{{lookup fmt "host"}}{{/each}}'],
      ['`fmt` in a condition', '{{#each data}}{{#if fmt}}y{{else}}n{{/if}}{{/each}}'],
      ['`with fmt`', '{{#each data}}{{#with fmt}}{{host}}{{/with}}{{/each}}'],
      [
        'a partial with hash arguments',
        '{{#*inline "p"}}{{fmt.host}}{{x}}{{/inline}}{{#each data}}{{> p x=1}}{{/each}}',
      ],
      ['a parent path', '{{#each data}}{{#each ../data}}{{../fmt.cpu}}{{/each}}{{/each}}'],
    ])('%s', (_name, content) => {
      for (const build of [frame, withoutFmtField, duplicateNames]) {
        const lazy = build();
        const eager = build();

        expect(render(content, { data: buildRows(lazy, [lazy]) })).toBe(
          render(content, { data: buildRowsEagerly(eager, [eager]) })
        );
      }
    });

    it('has a frame where two fields share a display name', () => {
      const built = duplicateNames();

      expect(built.fields.map((field) => getFieldDisplayName(field, built, [built]))).toEqual(['cpu', 'host', 'cpu']);
    });

    it('builds equal rows', () => {
      for (const build of [frame, withoutFmtField, duplicateNames]) {
        const lazy = build();
        const eager = build();

        expect(buildRows(lazy, [lazy])).toEqual(buildRowsEagerly(eager, [eager]));
      }
    });
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
