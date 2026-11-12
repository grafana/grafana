import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  type FieldConfigSource,
  FieldMatcherID,
  FieldType,
  getDisplayProcessor,
  type InterpolateFunction,
  MappingType,
  SpecialValueMatch,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { buildAllRowsContext, buildRows, compileTemplate, type TemplateContext } from './handlebars';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

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

const theme = createTheme();
const green = theme.visualization.getColorByName('green');
const orange = theme.visualization.getColorByName('orange');
const red = theme.visualization.getColorByName('red');
const blue = theme.visualization.getColorByName('blue');
const purple = theme.visualization.getColorByName('purple');

const fleet = toDataFrame({
  name: 'fleet',
  refId: 'A',
  fields: [
    { name: 'service', type: FieldType.string, values: ['checkout', 'payments', 'search'] },
    { name: 'status', type: FieldType.string, values: ['ok', 'degraded', null] },
    { name: 'cpu', type: FieldType.number, values: [0.942, 0.71, null], config: { min: 0, max: 1 } },
    { name: 'cost', type: FieldType.number, values: [1234.5, 20, 3.14159] },
    { name: 'Memory usage', type: FieldType.number, values: [1024, 2048, 5], config: { unit: 'bytes' } },
  ],
});

const fleetThresholds = {
  mode: ThresholdsMode.Absolute,
  steps: [
    { value: -Infinity, color: 'green' },
    { value: 0.7, color: 'orange' },
    { value: 0.9, color: 'red' },
  ],
};

const fleetConfig: FieldConfigSource = {
  defaults: { thresholds: fleetThresholds },
  overrides: [
    {
      matcher: { id: FieldMatcherID.byName, options: 'status' },
      properties: [
        {
          id: 'mappings',
          value: [
            {
              type: MappingType.ValueToText,
              options: {
                ok: { text: 'Healthy', color: 'green', icon: 'img/ok.svg', index: 0 },
                degraded: { text: '<b>Degraded</b>', color: 'orange', index: 1 },
              },
            },
            {
              type: MappingType.SpecialValue,
              options: { match: SpecialValueMatch.Null, result: { text: 'No report', color: 'blue', index: 2 } },
            },
          ],
        },
      ],
    },
    {
      matcher: { id: FieldMatcherID.byName, options: 'cpu' },
      properties: [
        { id: 'unit', value: 'percentunit' },
        { id: 'decimals', value: 1 },
        { id: 'noValue', value: 'n/a' },
      ],
    },
    {
      matcher: { id: FieldMatcherID.byName, options: 'cost' },
      properties: [
        { id: 'unit', value: 'currencyUSD' },
        { id: 'decimals', value: 2 },
        {
          id: 'thresholds',
          value: {
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'blue' },
              { value: 1000, color: 'purple' },
            ],
          },
        },
      ],
    },
  ],
};

function withFieldConfig(series: DataFrame[], fieldConfig: FieldConfigSource): DataFrame[] {
  return applyFieldOverrides({
    data: series,
    fieldConfig,
    replaceVariables: (value) => value,
    theme,
    timeZone: 'utc',
  });
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

describe('display', () => {
  const series = withFieldConfig([fleet], fleetConfig);

  function eachRow(expression: string, frames = series) {
    return render(`{{#each data}}[${expression}]{{/each}}`, buildAllRowsContext(frames));
  }

  it('prints the formatted value, as `fmt` does', () => {
    expect(eachRow('{{display "cpu"}}={{fmt.cpu}}')).toBe('[94.2%=94.2%][71.0%=71.0%][n/a=n/a]');
  });

  it('takes a field name with spaces as a quoted argument', () => {
    expect(eachRow("{{display 'Memory usage'}}")).toBe('[1 KiB][2 KiB][5 B]');
  });

  it.each([
    { property: 'text', expected: '[1.23][20.00][3.14]' },
    { property: 'prefix', expected: '[$][$][$]' },
    { property: 'suffix', expected: '[K][][]' },
    { property: 'numeric', expected: '[1234.5][20][3.14159]' },
  ])('reads $property apart from the rest of the formatted value', ({ property, expected }) => {
    expect(eachRow(`{{display "cost" "${property}"}}`)).toBe(expected);
  });

  it('colors a value from the threshold it falls in', () => {
    expect(eachRow('{{display "cpu" "color"}}')).toBe(`[${red}][${orange}][${green}]`);
  });

  it('takes the thresholds of a field override over the panel defaults', () => {
    expect(eachRow('{{display "cost" "color"}}')).toBe(`[${purple}][${blue}][${blue}]`);
  });

  it('reads the text and the color of the value mapping that matched', () => {
    expect(eachRow('{{{display "status" "text"}}} {{display "status" "color"}}')).toBe(
      `[Healthy ${green}][<b>Degraded</b> ${orange}][No report ${blue}]`
    );
  });

  it('prefers the color of a matching value mapping over the threshold', () => {
    const mapped = withFieldConfig([fleet], {
      defaults: {
        thresholds: fleetThresholds,
        mappings: [{ type: MappingType.RangeToText, options: { from: 0.9, to: 1, result: { color: 'blue' } } }],
      },
      overrides: [],
    });

    expect(eachRow('{{display "cpu" "color"}}', mapped)).toBe(`[${blue}][${orange}][${green}]`);
  });

  it('reads the position between the field min and max, and the icon of a value mapping', () => {
    expect(eachRow('{{display "cpu" "percent"}} {{display "status" "icon"}}')).toBe('[0.942 img/ok.svg][0.71 ][0 ]');
  });

  it('renders the no value text and the base threshold color for a null', () => {
    const [, , unreported] = buildAllRowsContext(series).data;

    expect(render('{{display "cpu" "text"}} {{display "cpu" "numeric"}} {{display "cpu" "color"}}', unreported)).toBe(
      `n/a NaN ${green}`
    );
  });

  it.each([
    { desc: 'a field that does not exist', expression: '{{display "nope"}}{{display "nope" "color"}}' },
    { desc: 'a property that does not exist', expression: '{{display "cpu" "nope"}}' },
    { desc: 'a prototype member', expression: '{{display "cpu" "toString"}}{{display "cpu" "constructor"}}' },
  ])('renders nothing for $desc', ({ expression }) => {
    expect(eachRow(expression)).toBe('[][][]');
  });

  it('exposes only the allowlisted properties when a display value holds more, inline and as a block', () => {
    const revenue = toDataFrame({ fields: [{ name: 'revenue', type: FieldType.number, values: [42000] }] });
    revenue.fields[0].display = () => ({
      text: '42',
      prefix: '$',
      suffix: 'K',
      numeric: 42000,
      color: '#73bf69',
      percent: 0.42,
      icon: 'img/up.svg',
      title: 'Revenue',
      percentChange: 0.1,
      description: 'Quarterly',
    });

    expect(eachRow('{{#display "revenue"}}{{#each this}}{{@key}}={{this}} {{/each}}{{/display}}', [revenue])).toBe(
      '[text=42 prefix=$ suffix=K numeric=42000 color=#73bf69 percent=0.42 icon=img/up.svg ]'
    );
    expect(
      eachRow(
        '{{display "revenue" "text"}}{{display "revenue" "title"}}{{display "revenue" "percentChange"}}{{display "revenue" "description"}}',
        [revenue]
      )
    ).toBe('[42]');
  });

  it('escapes a display value like any other value', () => {
    expect(eachRow('{{display "status"}}')).toBe('[Healthy][&lt;b&gt;Degraded&lt;/b&gt;][No report]');
  });

  it('compares on the number or the mapped text of a display value', () => {
    expect(
      eachRow(
        '{{#if (gt (display "cpu" "numeric") 0.9)}}hot{{/if}}{{#if (eq (display "status" "text") "Healthy")}} ok{{/if}}'
      )
    ).toBe('[hot ok][][]');
  });

  it('returns the formatted value as the string `fmt` holds, so the two compare equal', () => {
    expect(
      eachRow('{{#if (eq (display "cpu") fmt.cpu)}}same{{/if}}{{#if (eq (display "status") "Healthy")}} healthy{{/if}}')
    ).toBe('[same healthy][same][same]');
  });

  it('counts an empty formatted value as falsy, as `fmt` does', () => {
    const notes = toDataFrame({ fields: [{ name: 'note', type: FieldType.string, values: ['paged', ''] }] });

    expect(eachRow('{{#if (display "note")}}noted{{else}}blank{{/if}}', [notes])).toBe('[noted][blank]');
  });

  it('reads a field named like an object member', () => {
    const members = toDataFrame({
      fields: [
        { name: 'constructor', type: FieldType.string, values: ['built'] },
        { name: 'toString', type: FieldType.string, values: ['text'] },
      ],
    });

    expect(eachRow('{{display "constructor"}} {{display "toString"}} {{display "valueOf"}}', [members])).toBe(
      '[built text ]'
    );
  });

  it('resolves against the row itself when a template renders per row', () => {
    const compiled = compileTemplate(
      '{{service}} {{display "status" "text"}} {{display "cpu"}}',
      createReplaceVariables()
    );

    expect(buildRows(series[0], series).map((row) => compiled(row))).toEqual([
      'checkout Healthy 94.2%',
      'payments &lt;b&gt;Degraded&lt;/b&gt; 71.0%',
      'search No report n/a',
    ]);
  });

  it('resolves every row against the frame it came from', () => {
    const frames = withFieldConfig(
      [
        toDataFrame({ refId: 'A', fields: [{ name: 'cpu', type: FieldType.number, values: [0.95, 0.2] }] }),
        toDataFrame({ refId: 'B', fields: [{ name: 'cpu', type: FieldType.number, values: [0.95] }] }),
      ],
      {
        defaults: { thresholds: fleetThresholds },
        overrides: [
          {
            matcher: { id: FieldMatcherID.byFrameRefID, options: 'B' },
            properties: [
              {
                id: 'thresholds',
                value: { mode: ThresholdsMode.Absolute, steps: [{ value: -Infinity, color: 'purple' }] },
              },
            ],
          },
        ],
      }
    );

    expect(
      render(
        '{{#each frames}}{{refId}}:{{#each data}}{{display "cpu" "color"}} {{/each}}{{/each}}',
        buildAllRowsContext(frames)
      )
    ).toBe(`A:${red} ${green} B:${purple} `);
  });

  it('reads the same field as the row and `fmt` when two fields share a name', () => {
    const frames = withFieldConfig(
      [
        toDataFrame({
          fields: [
            { name: 'a', type: FieldType.number, values: [1], config: { displayName: 'load', unit: 'percent' } },
            { name: 'b', type: FieldType.number, values: [2], config: { displayName: 'load', unit: 'ms' } },
          ],
        }),
      ],
      { defaults: {}, overrides: [] }
    );

    expect(eachRow('{{load}} {{fmt.load}} {{display "load"}}', frames)).toBe('[2 2 ms 2 ms]');
  });

  it('falls back to the plain value for a frame without display processors', () => {
    expect(eachRow('{{display "cpu"}} {{display "cpu" "numeric"}} {{display "cpu" "color"}}', [hosts])).toBe(
      '[0.84 0.84 ][0.12 0.12 ]'
    );
  });

  describe('as a block', () => {
    it('renders the block with the display value as its context', () => {
      expect(eachRow('{{#display "cpu"}}{{color}} {{text}}{{suffix}} {{this}}{{/display}}')).toBe(
        `[${red} 94.2% 94.2%][${orange} 71.0% 71.0%][${green} n/a n/a]`
      );
    });

    it('names the display value with a block parameter', () => {
      expect(eachRow('{{#display "cpu" as |cpu|}}{{../service}} {{cpu.text}}{{/display}}')).toBe(
        '[checkout 94.2][payments 71.0][search n/a]'
      );
    });

    it('renders the else branch for a field that does not exist', () => {
      expect(eachRow('{{#display "nope"}}found{{else}}missing{{/display}}')).toBe('[missing][missing][missing]');
    });
  });

  describe('the row argument', () => {
    it('reads a row the template is not iterating', () => {
      expect(render('{{display "cpu" row=data.[1]}}', buildAllRowsContext(series))).toBe('71.0%');
    });

    it('reads the row from inside a block that changed the context', () => {
      expect(eachRow('{{#with service}}{{display "cpu"}}|{{display "cpu" row=..}}{{/with}}')).toBe(
        '[|94.2%][|71.0%][|n/a]'
      );
    });

    it('renders nothing when it is not a row', () => {
      expect(eachRow('{{display "cpu" row=service}}{{display "cpu" row=nope}}')).toBe('[][][]');
    });
  });

  describe('without a field name', () => {
    it('still reads a field named `display`, as a value and as a section', () => {
      const frame = toDataFrame({ fields: [{ name: 'display', type: FieldType.string, values: ['mine'] }] });
      const [row] = buildRows(frame, [frame]);

      expect(render('{{display}} {{#display}}{{this}}{{else}}none{{/display}} {{display "display"}}', row)).toBe(
        'mine mine mine'
      );
    });

    it('renders nothing, and the else branch of a section, where no field is named `display`', () => {
      expect(eachRow('{{display}}{{#display}}section{{else}}none{{/display}}')).toBe('[none][none][none]');
    });
  });

  describe('display processors', () => {
    function setup() {
      const frames = withFieldConfig([fleet], fleetConfig);
      const [status, cpu] = ['status', 'cpu'].map((name) => {
        const field = frames[0].fields.find((candidate) => candidate.name === name)!;
        const processor = jest.fn(field.display ?? getDisplayProcessor());
        field.display = processor;
        return processor;
      });

      return { context: buildAllRowsContext(frames), status, cpu };
    }

    it('run once per value, however many of its properties a template reads', () => {
      const { context, cpu } = setup();
      expect(cpu).toHaveBeenCalledTimes(3);

      render(
        '{{#each data}}{{display "cpu" "color"}}{{display "cpu" "text"}}{{display "cpu" "suffix"}}{{#display "cpu"}}{{color}}{{/display}}{{/each}}',
        context
      );

      expect(cpu).toHaveBeenCalledTimes(6);
    });

    it('run only for the fields a template asks for', () => {
      const { context, status, cpu } = setup();

      render('{{#each data}}{{display "cpu" "color"}}{{status}}{{fmt.status}}{{/each}}', context);

      expect(cpu).toHaveBeenCalledTimes(6);
      expect(status).toHaveBeenCalledTimes(3);
    });

    it('run again for the rows of a later render, which picks up new field configuration', () => {
      const recolored = withFieldConfig([fleet], {
        ...fleetConfig,
        defaults: { thresholds: { mode: ThresholdsMode.Absolute, steps: [{ value: -Infinity, color: 'purple' }] } },
      });

      expect(eachRow('{{display "cpu" "color"}}')).toBe(`[${red}][${orange}][${green}]`);
      expect(eachRow('{{display "cpu" "color"}}', recolored)).toBe(`[${purple}][${purple}][${purple}]`);
    });
  });
});
