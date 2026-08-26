import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  FieldType,
  type InterpolateFunction,
  standardFieldConfigEditorRegistry,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { RenderMode, TextMode } from '../panelcfg.gen';

import {
  catchTemplateError,
  hasRenderableData,
  interpolateTemplate,
  MAX_RENDERED_CHARS,
  MAX_RENDERED_ROWS,
  renderContent,
} from './renderContent';

beforeEach(() => {
  setTestFlags({ [FlagKeys.TextNewFeatures]: true });
});

afterAll(() => {
  setTestFlags({});
});

// applyFieldOverrides copies panel defaults through this registry, which app.ts seeds.
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

const hosts = toDataFrame({
  name: 'frameA',
  refId: 'A',
  fields: [
    { name: 'host', type: FieldType.string, values: ['web-1', 'web-2'] },
    { name: 'cpu', type: FieldType.number, values: [84, 12] },
  ],
});

const regions = toDataFrame({
  name: 'frameB',
  refId: 'B',
  fields: [{ name: 'host', type: FieldType.string, values: ['db-1'] }],
});

/** Rows numbered 0..n, so a rendered block names its own row index. */
function numberedFrame(rowCount: number) {
  return toDataFrame({
    fields: [{ name: 'n', type: FieldType.number, values: Array.from({ length: rowCount }, (_, i) => i) }],
  });
}

/** The real macro registry, so ${__data.*} resolution is not faked. */
function createReplaceVariables(): InterpolateFunction {
  const templateSrv = initTemplateSrv('hello', []);
  return (target, scopedVars, format) => templateSrv.replace(target, scopedVars, format);
}

function interpolate(
  content: string,
  series: DataFrame[] | undefined,
  renderMode: RenderMode | undefined,
  mode = TextMode.Markdown,
  maxRows?: number
) {
  return interpolateTemplate({ content, series, renderMode, mode, maxRows }, createReplaceVariables());
}

/** `interpolate` with an explicit row limit, in markdown mode. */
function withLimit(content: string, series: DataFrame[], renderMode: RenderMode, maxRows?: number) {
  return interpolate(content, series, renderMode, TextMode.Markdown, maxRows);
}

const theme = createTheme();
const green = theme.visualization.getColorByName('green');
const red = theme.visualization.getColorByName('red');

/**
 * Without this the frame has no `field.display`, the macro falls back to a processor
 * that returns no color, and every `.color` assertion silently passes on ''.
 */
function withThresholds(series: DataFrame[]): DataFrame[] {
  return applyFieldOverrides({
    data: series,
    fieldConfig: {
      defaults: {
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 80, color: 'red' },
          ],
        },
      },
      overrides: [],
    },
    replaceVariables: (value) => value,
    theme,
    timeZone: 'utc',
  });
}

describe('hasRenderableData', () => {
  it.each([
    ['undefined', undefined],
    ['no frames', []],
    ['a frame with no fields', [{ fields: [], length: 0 }]],
    ['a frame with fields but no rows', [toDataFrame({ fields: [{ name: 'host', values: [] }] })]],
  ])('returns false for %s', (_name, series) => {
    expect(hasRenderableData(series)).toBe(false);
  });

  it('returns true when any frame has rows', () => {
    expect(hasRenderableData([{ fields: [], length: 0 }, hosts])).toBe(true);
  });
});

describe('interpolateTemplate', () => {
  describe('all rows', () => {
    it.each([
      ['Once', RenderMode.Once],
      ['an undefined render mode', undefined],
    ])('renders the content once for %s', (_name, renderMode) => {
      expect(interpolate('CPU is ${__data.fields.cpu}%', [hosts], renderMode)).toBe('CPU is ${__data.fields.cpu}%');
    });
  });

  describe('every row', () => {
    it('repeats the content once per row, resolving fields for that row', () => {
      expect(interpolate('- ${__data.fields.host}: ${__data.fields.cpu}%', [hosts], RenderMode.PerRow)).toBe(
        '- web-1: 84%\n\n- web-2: 12%'
      );
    });

    it('iterates every frame in series order', () => {
      expect(interpolate('${__data.fields.host}', [hosts, regions], RenderMode.PerRow)).toBe('web-1\n\nweb-2\n\ndb-1');
    });

    it('resolves ${__series.name} so rows can name their frame', () => {
      expect(interpolate('${__series.name} ${__data.fields.host}', [hosts, regions], RenderMode.PerRow)).toBe(
        'frameA web-1\n\nframeA web-2\n\nframeB db-1'
      );
    });

    it('leaves references to unknown fields empty', () => {
      expect(interpolate('[${__data.fields.nope}]', [regions], RenderMode.PerRow)).toBe('[]');
    });

    it.each([
      ['HTML', TextMode.HTML],
      ['code', TextMode.Code],
    ])('joins rows with a single newline in %s mode', (_name, mode) => {
      expect(interpolate('${__data.fields.host}', [hosts], RenderMode.PerRow, mode)).toBe('web-1\nweb-2');
    });

    it.each([
      ['there is no data', undefined],
      ['every frame is empty', [{ fields: [], length: 0 }]],
    ])('falls back to a single render when %s', (_name, series) => {
      expect(interpolate('CPU is ${__data.fields.cpu}%', series, RenderMode.PerRow)).toBe(
        'CPU is ${__data.fields.cpu}%'
      );
    });

    it('colors each row from its own value', () => {
      const colored = '<span style="color:${__data.fields.cpu.color}">${__data.fields.cpu}</span>';

      expect(interpolate(colored, withThresholds([hosts]), RenderMode.PerRow)).toBe(
        `<span style="color:${red}">84</span>\n\n<span style="color:${green}">12</span>`
      );
    });

    it('renders at most the requested number of rows', () => {
      const blocks = withLimit('${__data.fields.n}', [numberedFrame(50)], RenderMode.PerRow, 10).split('\n\n');

      expect(blocks).toHaveLength(10);
      expect(blocks[9]).toBe('9');
    });

    it('renders every row when the limit is never reached', () => {
      expect(withLimit('${__data.fields.n}', [numberedFrame(3)], RenderMode.PerRow, 10)).toBe('0\n\n1\n\n2');
    });

    it.each([
      ['unset, on a panel saved before the option existed', undefined],
      ['zero', 0],
      ['not a number', NaN],
    ])('renders every row up to the hard ceiling when the limit is %s', (_name, maxRows) => {
      const series = [numberedFrame(MAX_RENDERED_ROWS + 10)];
      const blocks = withLimit('${__data.fields.n}', series, RenderMode.PerRow, maxRows).split('\n\n');

      expect(blocks).toHaveLength(MAX_RENDERED_ROWS);
      expect(blocks[MAX_RENDERED_ROWS - 1]).toBe(String(MAX_RENDERED_ROWS - 1));
    });

    it.each([
      ['above the hard ceiling', MAX_RENDERED_ROWS + 500, MAX_RENDERED_ROWS],
      ['below one', -5, 1],
    ])('clamps a row limit %s', (_name, maxRows, expected) => {
      const series = [numberedFrame(MAX_RENDERED_ROWS + 10)];
      const blocks = withLimit('${__data.fields.n}', series, RenderMode.PerRow, maxRows).split('\n\n');

      expect(blocks).toHaveLength(expected);
      expect(blocks[expected - 1]).toBe(String(expected - 1));
    });

    it('stops at the size backstop before reaching the row limit', () => {
      const row = 'x'.repeat(1000);
      const blocks = interpolate(row, [numberedFrame(MAX_RENDERED_ROWS)], RenderMode.PerRow).split('\n\n');

      expect(blocks).toHaveLength(MAX_RENDERED_CHARS / row.length);
      expect(blocks.length).toBeLessThan(MAX_RENDERED_ROWS);
    });
  });

  describe('handlebars', () => {
    it('leaves expressions alone when the text.newFeatures flag is off', () => {
      setTestFlags({ [FlagKeys.TextNewFeatures]: false });

      expect(interpolate('{{#each data}}{{host}}{{/each}}', [hosts], RenderMode.Once)).toBe(
        '{{#each data}}{{host}}{{/each}}'
      );
    });

    it('renders the whole result set for Once', () => {
      expect(interpolate('{{#each data}}- {{host}}\n{{/each}}', [hosts], RenderMode.Once)).toBe('- web-1\n- web-2\n');
    });

    it('caps the rows a Once template can iterate, so a huge frame cannot lock up the browser', () => {
      const series = [numberedFrame(MAX_RENDERED_ROWS + 10)];
      const rendered = interpolate('{{#each data}}{{n}},{{/each}}', series, RenderMode.Once);

      expect(rendered.split(',').filter(Boolean)).toHaveLength(MAX_RENDERED_ROWS);
    });

    it('applies the row limit to Once as well, so both modes see the same rows', () => {
      const template = '{{#each data}}{{n}},{{/each}}';
      const rendered = withLimit(template, [numberedFrame(50)], RenderMode.Once, 10);

      expect(rendered.split(',').filter(Boolean)).toHaveLength(10);
    });

    it('truncates a Once template that passes the size backstop', () => {
      const row = 'x'.repeat(1000);
      const wide = toDataFrame({
        fields: [{ name: 'n', type: FieldType.string, values: Array.from({ length: 400 }, () => row) }],
      });

      const rendered = interpolate('{{#each data}}{{n}}\n{{/each}}', [wide], RenderMode.Once);

      expect(rendered.length).toBeLessThanOrEqual(MAX_RENDERED_CHARS);
      // Every line is whole, so the cut landed on a line break rather than mid-row.
      expect(rendered.split('\n').every((line) => line === row)).toBe(true);
    });

    it('exposes every frame for Once', () => {
      expect(interpolate('{{#each frames}}{{name}}:{{data.length}} {{/each}}', [hosts, regions], undefined)).toBe(
        'frameA:2 frameB:1 '
      );
    });

    it('gives each row its own context for PerRow', () => {
      expect(interpolate('{{#if (gt cpu 50)}}**{{host}}** hot{{/if}}', [hosts], RenderMode.PerRow)).toBe(
        '**web-1** hot\n\n'
      );
    });

    it('runs before variable interpolation, so its output is still interpolated', () => {
      const nested = toDataFrame({
        fields: [
          { name: 'host', type: FieldType.string, values: ['${__data.fields.cpu}'] },
          { name: 'cpu', type: FieldType.number, values: [84] },
        ],
      });

      expect(interpolate('{{host}}', [nested], RenderMode.PerRow)).toBe('84');
    });

    it('is skipped in code mode, where escaping would mangle the source', () => {
      expect(interpolate('{ "a": "{{b}}" }', [hosts], RenderMode.Once, TextMode.Code)).toBe('{ "a": "{{b}}" }');
    });

    it('throws on a broken template, so the panel can surface the error', () => {
      expect(() => interpolate('{{#each data}}', [hosts], RenderMode.Once)).toThrow();
    });
  });
});

describe('renderContent', () => {
  function render(content: string, renderMode: RenderMode, mode = TextMode.Markdown) {
    return renderContent({ content, series: [hosts], renderMode, mode }, createReplaceVariables(), false);
  }

  it('renders repeated list items as a single list', () => {
    const html = render('- ${__data.fields.host}', RenderMode.PerRow);

    // The blank line between rows makes it a loose list, so items carry a <p>.
    expect(html).toContain('<li><p>web-1</p>');
    expect(html).toContain('<li><p>web-2</p>');
    expect(html.match(/<ul>/g)).toHaveLength(1);
  });

  it('keeps each row a separate block rather than one run-on paragraph', () => {
    const html = render('${__data.fields.host}', RenderMode.PerRow);

    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  it('leaves code mode content untransformed', () => {
    expect(render('${__data.fields.host},', RenderMode.PerRow, TextMode.Code)).toBe('web-1,\nweb-2,');
  });

  it('keeps threshold colors through markdown rendering and sanitization', () => {
    const html = renderContent(
      {
        content: '<span style="color:${__data.fields.cpu.color}">${__data.fields.cpu}</span>',
        series: withThresholds([hosts]),
        renderMode: RenderMode.PerRow,
        mode: TextMode.Markdown,
        // What the panel passes for markdown, and it escapes what it interpolates.
        format: 'html',
      },
      createReplaceVariables(),
      false
    );

    // The sanitizer rewrites the style attribute, adding a trailing semicolon.
    expect(html).toContain(`<span style="color:${red};">84</span>`);
    expect(html).toContain(`<span style="color:${green};">12</span>`);
  });

  it('sanitizes per-row HTML output', () => {
    expect(render('<b>${__data.fields.host}</b><script>alert(1)</script>', RenderMode.PerRow, TextMode.HTML)).toBe(
      '<b>web-1</b>&lt;script&gt;alert(1)&lt;/script&gt;\n<b>web-2</b>&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });
});

describe('catchTemplateError', () => {
  it('passes the content through when nothing throws', () => {
    expect(catchTemplateError(() => 'hello')).toEqual({ content: 'hello' });
  });

  it('describes the failure instead', () => {
    expect(
      catchTemplateError(() => {
        throw new Error('boom');
      })
    ).toEqual({ content: '', error: 'Handlebars error: boom' });
  });
});
