import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  type FieldConfigSource,
  FieldMatcherID,
  FieldType,
  MappingType,
  SpecialValueMatch,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { RenderMode, TextMode } from '../panelcfg.gen';

import { type FmtMigrationOptions, migrateFmt } from './fmtMigration';
import { getFieldNames } from './handlebars';
import { catchTemplateError, interpolateTemplate } from './renderContent';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

beforeEach(() => {
  setTestFlags({ [FlagKeys.TextNewFeatures]: true });
});

afterAll(() => {
  setTestFlags({});
});

const theme = createTheme();

const fieldConfig: FieldConfigSource = {
  defaults: {
    thresholds: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 0.7, color: 'red' },
      ],
    },
  },
  overrides: [
    {
      matcher: { id: FieldMatcherID.byName, options: 'status' },
      properties: [
        {
          id: 'mappings',
          value: [
            { type: MappingType.ValueToText, options: { ok: { text: '<b>Healthy</b>', color: 'green', index: 0 } } },
            {
              type: MappingType.SpecialValue,
              options: { match: SpecialValueMatch.Null, result: { text: 'No report', index: 1 } },
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
  ],
};

function withConfig(series: DataFrame[]): DataFrame[] {
  return applyFieldOverrides({ data: series, fieldConfig, replaceVariables: (value) => value, theme, timeZone: 'utc' });
}

const fleet = () =>
  withConfig([
    toDataFrame({
      name: 'fleet',
      refId: 'A',
      fields: [
        { name: 'service', type: FieldType.string, values: ['checkout', 'search', ''] },
        { name: 'status', type: FieldType.string, values: ['ok', null, 'down'] },
        { name: 'cpu', type: FieldType.number, values: [0.942, null, 0] },
        { name: 'Memory usage', type: FieldType.number, values: [1024, 5, 0], config: { unit: 'bytes' } },
        { name: 'say "hi"', type: FieldType.string, values: ['a"b', '<i>', ''] },
        { name: '0', type: FieldType.number, values: [7, 8, 9] },
        { name: 'meta', type: FieldType.other, values: [{ fmt: { cpu: 'nested' } }, null, { fmt: 'flat' }] },
      ],
    }),
  ]);

const frames = () =>
  withConfig([
    toDataFrame({
      name: 'web',
      refId: 'A',
      fields: [
        { name: 'service', type: FieldType.string, values: ['checkout', 'search'] },
        { name: 'cpu', type: FieldType.number, values: [0.1, 0.95] },
      ],
    }),
    toDataFrame({
      name: 'db',
      refId: 'B',
      fields: [
        { name: 'service', type: FieldType.string, values: ['postgres'] },
        { name: 'cpu', type: FieldType.number, values: [0.8] },
      ],
    }),
  ]);

const duplicates = () =>
  withConfig([
    toDataFrame({
      fields: [
        { name: 'a', type: FieldType.number, values: [1, 2], config: { displayName: 'cpu', unit: 'percent' } },
        { name: 'b', type: FieldType.number, values: [3, 4], config: { displayName: 'cpu', unit: 'ms' } },
      ],
    }),
  ]);

const shadowed = () =>
  withConfig([
    toDataFrame({
      fields: [
        { name: 'fmt', type: FieldType.other, values: [{ cpu: 'own' }, 'text'] },
        { name: 'cpu', type: FieldType.number, values: [0.5, 0.25] },
        { name: 'service', type: FieldType.string, values: ['checkout', 'search'] },
      ],
    }),
  ]);

const displayField = () =>
  withConfig([
    toDataFrame({
      fields: [
        { name: 'display', type: FieldType.other, values: [{ fmt: { cpu: 'own' } }, null] },
        { name: 'cpu', type: FieldType.number, values: [0.5, 0.25] },
      ],
    }),
  ]);

const hasFmtFieldIn = (series: DataFrame[]) => series.some((frame) => getFieldNames(frame, [frame]).includes('fmt'));

function migrate(content: string, options: Partial<FmtMigrationOptions> = {}) {
  return migrateFmt(content, {
    mode: TextMode.Markdown,
    renderMode: RenderMode.Once,
    hasFmtField: false,
    ...options,
  });
}

const replaceVariables = (() => {
  const templateSrv = initTemplateSrv('fmt-migration', []);
  return (target: string) => templateSrv.replace(target);
})();

function render(content: string, series: DataFrame[], renderMode = RenderMode.Once) {
  const { content: rendered, error } = catchTemplateError(() =>
    interpolateTemplate({ content, mode: TextMode.Markdown, series, renderMode, format: 'html' }, replaceVariables)
  );
  return error ?? rendered;
}

describe('migrateFmt', () => {
  describe('rewrites reads of the formatted values to display', () => {
    it.each([
      {
        desc: 'a read of the row a template renders per row',
        renderMode: RenderMode.PerRow,
        content: '{{service}}: {{fmt.cpu}}',
        expected: '{{service}}: {{display "cpu"}}',
      },
      {
        desc: 'a read inside each',
        content: '{{#each data}}[{{fmt.cpu}}]{{/each}}',
        expected: '{{#each data}}[{{display "cpu"}}]{{/each}}',
      },
      {
        desc: 'helper arguments and conditions, as sub-expressions',
        content: '{{#each data}}{{#if (eq fmt.status "Healthy")}}{{json fmt.cpu}}{{else if fmt.cpu}}x{{/if}}{{/each}}',
        expected:
          '{{#each data}}{{#if (eq (display "status") "Healthy")}}{{json (display "cpu")}}{{else if (display "cpu")}}x{{/if}}{{/each}}',
      },
      {
        desc: 'unescaped and whitespace-controlled reads, keeping their delimiters',
        renderMode: RenderMode.PerRow,
        content: '{{{fmt.status}}} {{&fmt.status}} {{~ fmt.cpu ~}}',
        expected: '{{{display "status"}}} {{&display "status"}} {{~ display "cpu" ~}}',
      },
      {
        desc: 'an explicit row, as the row argument',
        content: '{{data.[1].fmt.cpu}} {{frames.[0].data.[0].fmt.cpu}} {{@root.data.[2].fmt.cpu}}',
        expected:
          '{{display "cpu" row=data.[1]}} {{display "cpu" row=frames.[0].data.[0]}} {{display "cpu" row=@root.data.[2]}}',
      },
      {
        desc: 'a parent row',
        content:
          '{{#each data}}{{#with service}}{{../fmt.cpu}}{{#with ../status}}{{../../fmt.cpu}}{{/with}}{{/with}}{{/each}}',
        expected:
          '{{#each data}}{{#with service}}{{display "cpu" row=..}}{{#with ../status}}{{display "cpu" row=../..}}{{/with}}{{/with}}{{/each}}',
      },
      {
        desc: 'a row named by a block param',
        content: '{{#each data as |row|}}{{row.fmt.cpu}}{{/each}}',
        expected: '{{#each data as |row|}}{{display "cpu" row=row}}{{/each}}',
      },
      {
        desc: 'a block param read as a data variable, which Handlebars resolves before @index',
        content: '{{#each data as |index|}}{{@index.fmt.cpu}}{{/each}}',
        expected: '{{#each data as |index|}}{{display "cpu" row=@index}}{{/each}}',
      },
      {
        desc: 'a row read through this',
        renderMode: RenderMode.PerRow,
        content: '{{this.fmt.cpu}} {{./fmt.cpu}}',
        expected: '{{display "cpu"}} {{display "cpu"}}',
      },
      {
        desc: 'a row read through this, kept that way so a block param of the same name stays out of it',
        content: '{{#each frames as |data|}}{{this.data.[0].fmt.cpu}}{{/each}}',
        expected: '{{#each frames as |data|}}{{display "cpu" row=this.data.[0]}}{{/each}}',
      },
      {
        desc: 'a lookup of a formatted value by a literal name',
        content:
          '{{#each data}}{{lookup fmt "cpu"}} {{~lookup fmt 0~}} {{json (lookup fmt "Memory usage")}}{{/each}}{{lookup data.[1].fmt "cpu"}}',
        expected:
          '{{#each data}}{{display "cpu"}} {{~display "0"~}} {{json (display "Memory usage")}}{{/each}}{{display "cpu" row=data.[1]}}',
      },
      {
        desc: 'a read inside each called through this, which the renderer still treats as each',
        content: '{{#this.each data}}{{fmt.cpu}}{{/this.each}}',
        expected: '{{#this.each data}}{{display "cpu"}}{{/this.each}}',
      },
      {
        desc: 'a lookup on a formatted value, which keeps the lookup and converts the read',
        content: '{{#each data}}{{lookup fmt.service "length"}}{{/each}}',
        expected: '{{#each data}}{{lookup (display "service") "length"}}{{/each}}',
      },
      {
        desc: 'a read inside an inline partial that every call passes a row without hash arguments',
        content:
          '{{#*inline "cell"}}{{fmt.cpu}}{{/inline}}{{#*inline "line"}}{{> cell}}{{/inline}}{{#each data}}{{> line}}{{/each}}{{> cell data.[0]}}',
        expected:
          '{{#*inline "cell"}}{{display "cpu"}}{{/inline}}{{#*inline "line"}}{{> cell}}{{/inline}}{{#each data}}{{> line}}{{/each}}{{> cell data.[0]}}',
      },
      {
        desc: 'a read inside an inline partial nothing calls, which never renders',
        content: '{{#*inline "unused"}}{{fmt.cpu}}{{/inline}}',
        expected: '{{#*inline "unused"}}{{display "cpu"}}{{/inline}}',
      },
      {
        desc: 'a data path named like a block param, which the renderer resolves to the block param',
        content: '{{#each data as |row|}}{{@row.fmt.cpu}}{{/each}}',
        expected: '{{#each data as |row|}}{{display "cpu" row=@row}}{{/each}}',
      },
      {
        desc: 'field names written in brackets or with slashes, as quoted names',
        renderMode: RenderMode.PerRow,
        content:
          '{{fmt.[Memory usage]}} {{fmt.[say "hi"]}} {{fmt.[0]}} {{fmt/cpu}} {{[fmt].cpu}} {{fmt.[Size [MB\\]]}}',
        expected:
          '{{display "Memory usage"}} {{display "say \\"hi\\""}} {{display "0"}} {{display "cpu"}} {{display "cpu"}} {{display "Size [MB]"}}',
      },
    ])('$desc', ({ content, renderMode, expected }) => {
      const migration = migrate(content, { renderMode });

      expect(migration.content).toBe(expected);
      expect(migration.unconverted).toEqual([]);
      expect(migrate(expected, { renderMode })).toEqual({ content: expected, changes: [], unconverted: [] });
    });

    it('lists every expression it rewrites, with its offsets in the content and its replacement', () => {
      expect(migrate('{{#each data}}{{fmt.cpu}}{{#if (eq fmt.status "")}}-{{/if}}{{/each}}').changes).toEqual([
        { from: 16, to: 23, line: 1, text: 'display "cpu"' },
        { from: 35, to: 45, line: 1, text: '(display "status")' },
      ]);
    });

    it('keeps every other character of the content as it was', () => {
      const content =
        '# Fleet\r\n<!-- {{fmt.cpu}} -->\t{{!-- fmt.cpu --}}\r\n{{#each data}}\r\n- **{{service}}** {{fmt.cpu}} ✓\r\n{{/each}}\r\n\\{{fmt.cpu}}';

      expect(migrate(content).content).toBe(
        '# Fleet\r\n<!-- {{fmt.cpu}} -->\t{{!-- fmt.cpu --}}\r\n{{#each data}}\r\n- **{{service}}** {{display "cpu"}} ✓\r\n{{/each}}\r\n\\{{fmt.cpu}}'
      );
    });
    it.each([
      { desc: 'a lone carriage return', content: 'a\r{{fmt.cpu}}', expected: 'a\r{{display "cpu"}}' },
      {
        desc: 'a line separator after a line break, which Handlebars counts columns wrongly after',
        content: 'a\n\u2028{{fmt.cpu}} {{fmt.status}}',
        expected: 'a\n\u2028{{display "cpu"}} {{display "status"}}',
      },
    ])('rewrites the right characters after $desc', ({ content, expected }) => {
      expect(migrate(content, { renderMode: RenderMode.PerRow }).content).toBe(expected);
    });
  });

  describe('leaves reads that could render differently through display, and says why', () => {
    it.each([
      { desc: 'fmt read as a whole', content: '{{#each data}}{{fmt}}{{/each}}', read: 'fmt', reason: 'namespace' },
      {
        desc: 'each over fmt',
        content: '{{#each data}}{{#each fmt}}{{this}}{{/each}}{{/each}}',
        read: 'fmt',
        reason: 'namespace',
      },
      {
        desc: 'with on fmt',
        content: '{{#each data}}{{#with fmt}}{{cpu}}{{/with}}{{/each}}',
        read: 'fmt',
        reason: 'namespace',
      },
      {
        desc: 'lookup on fmt with a key that is not a literal',
        content: '{{#each data}}{{lookup fmt service}}{{/each}}',
        read: 'fmt',
        reason: 'namespace',
      },
      {
        desc: 'a lookup of fmt by name',
        content: '{{#each data}}{{lookup this "fmt"}}{{/each}}',
        read: '{{lookup this "fmt"}}',
        reason: 'namespace',
      },
      {
        desc: 'a read past the formatted value',
        content: '{{#each data}}{{fmt.service.length}}{{/each}}',
        read: 'fmt.service.length',
        reason: 'expression',
      },
      {
        desc: 'a formatted value opening a block',
        content: '{{#each data}}{{#fmt.cpu}}{{this}}{{/fmt.cpu}}{{/each}}',
        read: 'fmt.cpu',
        reason: 'expression',
      },
      {
        desc: 'a read inside a block on a field value, which can be an object with its own fmt',
        content: '{{#each data}}{{#with meta}}{{fmt.cpu}}{{/with}}{{/each}}',
        read: 'fmt.cpu',
        reason: 'row',
      },
      {
        desc: 'a read inside an inline partial, which a call with hash arguments passes a copy of the row',
        content: '{{#*inline "cell"}}{{fmt.cpu}}{{/inline}}{{#each data}}{{> cell}}{{> cell size=1}}{{/each}}',
        read: 'fmt.cpu',
        reason: 'row',
      },
      {
        desc: 'a read inside an inline partial called from a partial that receives a copy of the row',
        content:
          '{{#*inline "cell"}}{{fmt.cpu}}{{/inline}}{{#*inline "line"}}{{> cell}}{{/inline}}{{#each data}}{{> line size=1}}{{/each}}',
        read: 'fmt.cpu',
        reason: 'row',
      },
      {
        desc: 'a read inside an inline partial defined twice, which the call that runs depends on scope',
        content:
          '{{#*inline "cell"}}{{fmt.cpu}}{{/inline}}{{#each data}}{{#*inline "cell"}}-{{/inline}}{{> cell}}{{/each}}',
        read: 'fmt.cpu',
        reason: 'row',
      },
      {
        desc: 'a read inside an inline partial when another partial name is only known at render time',
        content:
          '{{#*inline "cell"}}{{fmt.cpu}}{{/inline}}{{#*inline service}}-{{/inline}}{{#each data}}{{> cell}}{{/each}}',
        read: 'fmt.cpu',
        reason: 'row',
      },
      {
        desc: 'a data path that can stop at a falsy value and render it',
        content: '{{@root.data.length.fmt.cpu}}',
        read: '@root.data.length.fmt.cpu',
        reason: 'row',
      },
      {
        desc: 'the __proto__ field, which fmt never holds',
        renderMode: RenderMode.PerRow,
        content: '{{fmt.__proto__}}',
        read: 'fmt.__proto__',
        reason: 'name',
      },
      {
        desc: 'a field name holding a line separator',
        renderMode: RenderMode.PerRow,
        content: '{{fmt.[a\u2028b]}}',
        read: 'fmt.[a\u2028b]',
        reason: 'name',
      },
      {
        desc: 'a field name ending in a backslash, which would escape the closing quote',
        renderMode: RenderMode.PerRow,
        content: '{{fmt.[C:\\\\]}}',
        read: 'fmt.[C:\\\\]',
        reason: 'name',
      },
    ])('$desc', ({ content, renderMode, read, reason }) => {
      const migration = migrate(content, { renderMode });

      expect(migration.content).toBe(content);
      expect(migration.unconverted.map(({ from, to, reason }) => ({ read: content.slice(from, to), reason }))).toEqual([
        { read, reason },
      ]);
    });

    it('leaves every read of a row when a field is displayed as fmt, since fmt is then that field', () => {
      const content = '{{#each data}}[{{fmt.cpu}}]{{/each}}';
      const migration = migrate(content, { hasFmtField: true });

      expect(migration).toEqual({
        content,
        changes: [],
        unconverted: [{ from: 17, to: 24, line: 1, reason: 'shadowed' }],
      });
      expect(render(content, shadowed())).toBe('[own][]');
      expect(render('{{#each data}}[{{display "cpu"}}]{{/each}}', shadowed())).toBe('[50.0%][25.0%]');
    });

    it('reads a block param named root as that block param, not as @root, the way Handlebars does', () => {
      const content = '{{#each data as |root|}}[{{@root.fmt.cpu}}]{{/each}}';
      const migration = migrate(content, { hasFmtField: true });

      expect(migration.content).toBe(content);
      expect(migration.unconverted.map(({ from, to, reason }) => ({ read: content.slice(from, to), reason }))).toEqual([
        { read: '@root.fmt.cpu', reason: 'shadowed' },
      ]);
      expect(render(content, shadowed())).toBe('[own][]');
    });

    it.each([
      { desc: 'in text', content: '{{#each data as |display|}}[{{fmt.cpu}}]{{/each}}', read: 'fmt.cpu' },
      {
        desc: 'on the block param',
        content: '{{#each data as |display|}}{{display.fmt.cpu}}{{/each}}',
        read: 'display.fmt.cpu',
      },
      {
        desc: 'in a helper argument further in',
        content: '{{#with this as |display|}}{{#each data}}{{#if (eq fmt.cpu "")}}-{{/if}}{{/each}}{{/with}}',
        read: 'fmt.cpu',
      },
    ])('leaves reads where a block param named display hides the helper: $desc', ({ content, read }) => {
      const migration = migrate(content);

      expect(migration.content).toBe(content);
      expect(migration.unconverted.map(({ from, to, reason }) => ({ read: content.slice(from, to), reason }))).toEqual([
        { read, reason: 'helper' },
      ]);
    });

    it('converts the reads outside the block param that hides the helper', () => {
      const content = '{{#each data as |display|}}{{fmt.cpu}}{{/each}}{{#each data}}{{fmt.cpu}}{{/each}}';

      expect(migrate(content).content).toBe(
        '{{#each data as |display|}}{{fmt.cpu}}{{/each}}{{#each data}}{{display "cpu"}}{{/each}}'
      );
      expect(render('{{#each data as |display|}}{{display "cpu"}};{{/each}}', fleet())).toBe(
        '[object Object];[object Object];[object Object];'
      );
    });

    it.each([
      { desc: 'a call', content: '{{#each data}}{{#with (display row=this)}}[{{fmt.cpu}}]{{/with}}{{/each}}' },
      { desc: 'a block', content: '{{#each data}}{{#display row=this}}[{{fmt.cpu}}]{{/display}}{{/each}}' },
    ])('leaves reads under display without a field name, which gives the field named display: $desc', ({ content }) => {
      const migration = migrate(content, { hasFmtField: false });

      expect(migration.content).toBe(content);
      expect(migration.unconverted.map(({ from, to, reason }) => ({ read: content.slice(from, to), reason }))).toEqual([
        { read: 'fmt.cpu', reason: 'row' },
      ]);
      expect(render(content, displayField())).toBe('[own]');
    });

    it.each([
      {
        desc: 'a block entered on a missing context, which Handlebars counts as a level',
        content:
          '{{#each data}}{{#*inline "p"}}{{#if nope}}{{else}}{{../../fmt.cpu}}{{/if}}{{/inline}}{{> p nope}};{{/each}}',
        read: '../../fmt.cpu',
      },
      {
        desc: 'a block whose context equals the one before it, which Handlebars does not count as a level',
        content:
          '{{#each data}}{{#with (display "service")}}{{#display "service" row=..}}{{../fmt.cpu}}{{/display}}{{/with}};{{/each}}',
        read: '../fmt.cpu',
      },
    ])('resolves parent paths past $desc', ({ content, read }) => {
      const migration = migrate(content, { hasFmtField: true });

      expect(migration.unconverted.map(({ from, to, reason }) => ({ read: content.slice(from, to), reason }))).toEqual([
        { read, reason: 'shadowed' },
      ]);
      expect(render(content, shadowed())).toBe('own;;');
    });

    it('converts the reads next to a block opened by a formatted value', () => {
      const content = '{{#each data}}{{#fmt.cpu}}{{this}}{{/fmt.cpu}}{{fmt.status}}{{/each}}';
      const migration = migrate(content);

      expect(migration.content).toBe('{{#each data}}{{#fmt.cpu}}{{this}}{{/fmt.cpu}}{{display "status"}}{{/each}}');
      expect(migration.unconverted).toEqual([{ from: 17, to: 24, line: 1, reason: 'expression' }]);
    });

    it('converts the reads it can and reports the rest, in content order', () => {
      const content = '{{#each data}}{{fmt.cpu}}{{#each fmt}}{{this}}{{/each}}{{fmt.status}}{{/each}}';
      const migration = migrate(content);

      expect(migration.content).toBe(
        '{{#each data}}{{display "cpu"}}{{#each fmt}}{{this}}{{/each}}{{display "status"}}{{/each}}'
      );
      expect(migration.changes).toHaveLength(2);
      expect(migration.unconverted).toEqual([{ from: 33, to: 36, line: 1, reason: 'namespace' }]);
    });

    it('reports offsets in the content when comments before a read are escaped for parsing', () => {
      const content = '<!-- {{a}} {{b}} -->\r\n{{#each data}}{{#each fmt}}{{/each}}{{/each}}';
      const [read] = migrate(content).unconverted;

      expect(content.slice(read.from, read.to)).toBe('fmt');
      expect(read.from).toBe(44);
      expect(read.line).toBe(2);
    });

    it('gives the line of each read, counting line breaks the way the editor does', () => {
      const content =
        '<!-- {{a}}\n{{b}} -->\n{{#each data}}\r\n{{fmt.cpu}}\r{{fmt.status}}\u2028{{#each fmt}}{{/each}}{{/each}}';
      const migration = migrate(content);

      expect(migration.changes.map(({ line, text }) => ({ line, text }))).toEqual([
        { line: 4, text: 'display "cpu"' },
        { line: 5, text: 'display "status"' },
      ]);
      expect(migration.unconverted.map(({ line, reason }) => ({ line, reason }))).toEqual([
        { line: 5, reason: 'namespace' },
      ]);
    });
  });

  describe('does not touch what is not a read of the formatted values', () => {
    it.each([
      { desc: 'a block param named fmt', content: '{{#each data as |fmt|}}{{fmt.cpu}}{{/each}}' },
      { desc: 'a data variable named fmt', content: '{{#each data}}{{@fmt.cpu}}{{/each}}' },
      { desc: 'a string literal', content: '{{#each data}}{{#if (eq service "fmt.cpu")}}x{{/if}}{{/each}}' },
      { desc: 'a Handlebars comment', content: '{{!-- {{fmt.cpu}} --}}{{! fmt.cpu }}' },
      { desc: 'an HTML comment, which the renderer escapes', content: '<!-- {{#each data}}{{fmt.cpu}}{{/each}} -->' },
      { desc: 'an escaped expression', content: '\\{{fmt.cpu}}' },
      { desc: 'a raw block', content: '{{{{raw}}}}{{fmt.cpu}}{{{{/raw}}}}' },
    ])('$desc', ({ content }) => {
      expect(migrate(content, { renderMode: RenderMode.PerRow })).toEqual({ content, changes: [], unconverted: [] });
    });

    it('leaves Code mode alone, which shows the content as it is', () => {
      const content = '{{fmt.cpu}}';

      expect(migrate(content, { mode: TextMode.Code, renderMode: RenderMode.PerRow })).toEqual({
        content,
        changes: [],
        unconverted: [],
      });
    });

    it('leaves the content alone when the text.newFeatures flag is off, since Handlebars does not run', () => {
      setTestFlags({ [FlagKeys.TextNewFeatures]: false });
      const content = '{{fmt.cpu}}';

      expect(migrate(content, { renderMode: RenderMode.PerRow })).toEqual({ content, changes: [], unconverted: [] });
    });

    it.each([
      { desc: 'a syntax error', content: '{{#each data}}{{fmt.cpu}}' },
      { desc: 'a partial block, which the panel cannot render', content: '{{#> layout}}{{fmt.cpu}}{{/layout}}' },
      { desc: 'a dynamic partial, which the panel cannot render', content: '{{> (lookup . "name")}}{{fmt.cpu}}' },
    ])('leaves a template the panel cannot compile alone: $desc', ({ content }) => {
      expect(migrate(content, { renderMode: RenderMode.PerRow })).toEqual({ content, changes: [], unconverted: [] });
    });
  });
});

describe('rendering after the conversion', () => {
  const templates = [
    { content: '{{#each data}}- {{service}}: {{fmt.cpu}} ({{{fmt.status}}}){{/each}}', once: 2, perRow: 0 },
    {
      content:
        '{{#each data}}{{#unless (eq fmt.service "")}}{{fmt.service}}{{/unless}}{{#if (eq fmt.cpu "n/a")}} idle{{/if}};{{/each}}',
      once: 3,
      perRow: 0,
    },
    {
      content:
        '{{data.[0].fmt.cpu}}|{{data.[2].fmt.status}}|{{data.[9].fmt.cpu}}|{{@root.data.[1].fmt.[Memory usage]}}',
      once: 4,
      perRow: 0,
    },
    { content: '{{#each frames}}{{refId}}={{#each data}}{{fmt.cpu}},{{/each}}{{/each}}', once: 1, perRow: 0 },
    {
      content:
        '{{#each data as |row i|}}{{i}}:{{row.fmt.cpu}}{{#each ../data as |other|}}{{other.fmt.cpu}}{{/each}};{{/each}}',
      once: 2,
      perRow: 0,
    },
    {
      content:
        '{{#each data}}{{#with service}}{{../fmt.cpu}}{{#with ../status}}{{../../fmt.cpu}}{{/with}}{{/with}};{{/each}}',
      once: 2,
      perRow: 0,
    },
    {
      content:
        '{{#each data as |index|}}{{@index.fmt.cpu}}|{{/each}}{{#each data as |root|}}{{@root.fmt.status}}|{{/each}}',
      once: 2,
      perRow: 0,
    },
    {
      content:
        '{{#each data}}{{fmt.[Memory usage]}}|{{fmt.[say "hi"]}}|{{fmt.[0]}}|{{fmt.nope}}|{{fmt.toString}}|{{fmt.constructor}};{{/each}}',
      once: 6,
      perRow: 0,
    },
    {
      content: '{{#each data}}{{#*inline "cell"}}{{../fmt.cpu}}{{/inline}}{{> cell size=1}};{{/each}}',
      once: 1,
      perRow: 0,
    },
    {
      content:
        '{{#each data}}{{#each fmt}}{{@key}}={{this}},{{/each}}{{lookup fmt "cpu"}}{{#with fmt}}{{cpu}}{{/with}}{{fmt.cpu}};{{/each}}',
      once: 2,
      perRow: 0,
    },
    {
      content:
        '{{#*inline "line"}}{{service}}: {{fmt.cpu}} {{lookup fmt "Memory usage"}}{{/inline}}{{#each data}}{{> line}};{{/each}}{{> line data.[1]}}',
      once: 2,
      perRow: 0,
    },
    { content: '{{#each data as |row|}}{{@row.fmt.cpu}}|{{lookup row.fmt "status"}};{{/each}}', once: 2, perRow: 0 },
    {
      content: '{{#each data}}{{#*inline "p"}}{{fmt.service}}{{x}}{{/inline}}{{> p x=1}}{{fmt.service}};{{/each}}',
      once: 1,
      perRow: 0,
    },
    {
      content: '{{service}} {{fmt.cpu}} {{{fmt.status}}} {{#if fmt.[say "hi"]}}said {{fmt.[say "hi"]}}{{/if}}',
      once: 4,
      perRow: 4,
    },
    {
      content: '{{#with service}}{{../fmt.cpu}}{{/with}} {{@root.fmt.status}} {{this.fmt.[Memory usage]}}',
      once: 3,
      perRow: 3,
    },
  ];

  describe.each([
    { name: 'units, mappings, overrides and missing values', series: fleet },
    { name: 'several frames', series: frames },
    { name: 'two fields displayed under one name', series: duplicates },
    { name: 'no query results', series: (): DataFrame[] => [] },
  ])('with $name', ({ series }) => {
    it.each(templates)('renders $content the same in Once and Per row modes', ({ content, once, perRow }) => {
      const hasFmtField = hasFmtFieldIn(series());

      for (const { renderMode, expected } of [
        { renderMode: RenderMode.Once, expected: once },
        { renderMode: RenderMode.PerRow, expected: perRow },
      ]) {
        const migration = migrate(content, { renderMode, hasFmtField });

        expect(migration.changes).toHaveLength(expected);
        expect(render(migration.content, series(), renderMode)).toBe(render(content, series(), renderMode));
      }
    });
  });

  it('renders the formatted values it rendered through fmt', () => {
    const content = '{{#each data}}[{{fmt.cpu}} {{{fmt.status}}} {{fmt.[Memory usage]}}]{{/each}}';
    const migrated = migrate(content).content;

    expect(migrated).toBe(
      '{{#each data}}[{{display "cpu"}} {{{display "status"}}} {{display "Memory usage"}}]{{/each}}'
    );
    expect(render(migrated, fleet())).toBe('[94.2% <b>Healthy</b> 1 KiB][n/a No report 5 B][0.0% down 0 B]');
    expect(render(content, fleet())).toBe('[94.2% <b>Healthy</b> 1 KiB][n/a No report 5 B][0.0% down 0 B]');
  });

  it('renders randomly generated templates the same after converting them, on any data the conversion allows', () => {
    const next = createRandom(138488);
    const generate = createTemplateGenerator(next);
    const datasets = [fleet, frames, shadowed, displayField];
    let converted = 0;

    for (let index = 0; index < 150; index++) {
      const content = generate();

      for (const renderMode of [RenderMode.Once, RenderMode.PerRow]) {
        for (const hasFmtField of [false, true]) {
          const migration = migrate(content, { renderMode, hasFmtField });
          converted += migration.changes.length;

          if (migration.changes.length === 0) {
            continue;
          }
          for (const series of datasets.filter((dataset) => hasFmtField || !hasFmtFieldIn(dataset()))) {
            expect({ content, renderMode, output: render(migration.content, series(), renderMode) }).toEqual({
              content,
              renderMode,
              output: render(content, series(), renderMode),
            });
          }
          expect(migrate(migration.content, { renderMode, hasFmtField }).changes).toEqual([]);
        }
      }
    }

    expect(converted).toBeGreaterThan(1000);
  });
});

function createRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createTemplateGenerator(next: () => number): () => string {
  const pick = <T>(items: T[]): T => items[Math.floor(next() * items.length)];
  const params: string[] = [];
  const partials = ['pa', 'pb'];
  let partial: string | undefined;
  const field = () => pick(['cpu', 'status', 'service', '[Memory usage]', '[say "hi"]', 'nope', 'meta']);
  const param = () => (params.length ? pick(params) : 'this');
  const call = (name: string) => `{{> ${name}${pick(['', ' x=1', ' this', ' data.[0]', ' ..'])}}}`;

  const value = () =>
    pick([
      params.length ? `@${pick(params)}.fmt.${field()}` : `@root.fmt.${field()}`,
      `fmt.${field()}`,
      `this.fmt.${field()}`,
      `../fmt.${field()}`,
      `../../fmt.${field()}`,
      `data.[${pick(['0', '1', '5'])}].fmt.${field()}`,
      `@root.data.[0].fmt.${field()}`,
      `@root.fmt.${field()}`,
      `frames.[${pick(['0', '1'])}].data.[0].fmt.${field()}`,
      `meta.fmt.${field()}`,
      `${param()}.fmt.${field()}`,
      `fmt.${field()}.length`,
      'fmt',
      field(),
      '@index',
    ]);

  const list = () => pick(['data', 'frames', 'this', 'fmt', '../data', '@root.data', '(split service "e")', 'meta']);
  const object = () =>
    pick(['this', 'data.[0]', 'fmt', 'meta', '(lookup data 0)', '..', '(display)', '(display row=..)', param()]);

  const statement = (depth: number): string => {
    switch (depth > 3 ? Math.floor(next() * 3) : Math.floor(next() * 14)) {
      case 0:
        return pick(['-', '\n', '<!-- {{fmt.cpu}} -->', '\\{{fmt.cpu}}']);
      case 1:
        return `{{${value()}}}`;
      case 2:
        return pick([`{{{${value()}}}}`, `{{~${value()}~}}`]);
      case 3:
        return `{{#if ${value()}}}${body(depth + 1)}{{else}}${body(depth + 1)}{{/if}}`;
      case 4:
        return `{{#unless (eq ${value()} "")}}${body(depth + 1)}{{/unless}}`;
      case 5:
        return `{{#each ${list()}}}${body(depth + 1)}{{/each}}`;
      case 6: {
        const name = pick([`row${depth}`, 'display', 'root', 'index']);
        params.push(name);
        const result = `{{#each ${list()} as |${name} index${depth}|}}${body(depth + 1)}{{/each}}`;
        params.pop();
        return result;
      }
      case 7:
        return `{{#with ${object()}}}${body(depth + 1)}{{else}}${body(depth + 1)}{{/with}}`;
      case 8:
        return pick([
          `{{#display "${pick(['cpu', 'status'])}"}}${body(depth + 1)}{{/display}}`,
          `{{#display row=this}}${body(depth + 1)}{{/display}}`,
        ]);
      case 9:
        return pick([
          `{{lookup ${pick(['fmt', 'this', 'data.[0]', '../fmt', 'data.[1].fmt', `${param()}.fmt`, `fmt.${field()}`])} ${pick(['"fmt"', '"cpu"', '"Memory usage"', '0', 'service', '"length"'])}}}`,
          `{{json (lookup ${pick(['fmt', '../fmt', '@root.fmt'])} "status")}}`,
        ]);
      case 10:
        return `{{#*inline "p${depth}"}}${body(depth + 1)}{{/inline}}{{> p${depth}${pick(['', ' x=1', ' this', ' data.[0]'])}}}`;
      case 11: {
        const name = pick(partials);
        const outer = partial;
        partial = name;
        const definition = `{{#*inline "${name}"}}${body(depth + 1)}{{/inline}}`;
        partial = outer;
        return `${definition}${call(name)}`;
      }
      case 12: {
        const callable = partials.filter((name) => partial === undefined || name < partial);
        return callable.length ? call(pick(callable)) : '';
      }
      default:
        return `{{json ${value()}}}`;
    }
  };

  const body = (depth: number): string =>
    Array.from({ length: 1 + Math.floor(next() * 3) }, () => statement(depth)).join('');

  return () => `${body(0)}{{#each data}}${body(1)}{{/each}}`;
}
