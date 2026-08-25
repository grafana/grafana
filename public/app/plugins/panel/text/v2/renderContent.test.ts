import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  FALLBACK_COLOR,
  type FieldConfig,
  FieldType,
  type InterpolateFunction,
  MappingType,
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

const services = toDataFrame({
  name: 'frameC',
  refId: 'C',
  fields: [
    { name: 'service', type: FieldType.string, values: ['checkout', 'payments', 'search'] },
    { name: 'state', type: FieldType.string, values: ['ok', 'degraded', 'unknown'] },
  ],
});

/** The real macro registry, so ${__data.*} resolution is not faked. */
function createReplaceVariables(): InterpolateFunction {
  const templateSrv = initTemplateSrv('hello', []);
  return (target, scopedVars, format) => templateSrv.replace(target, scopedVars, format);
}

function interpolate(
  content: string,
  series: DataFrame[] | undefined,
  renderMode: RenderMode | undefined,
  mode = TextMode.Markdown
) {
  return interpolateTemplate({ content, series, renderMode, mode }, createReplaceVariables());
}

const theme = createTheme();
const green = theme.visualization.getColorByName('green');
const red = theme.visualization.getColorByName('red');
const blue = theme.visualization.getColorByName('blue');

/**
 * Without this the frame has no `field.display`, the macro falls back to a processor
 * that returns no color, and every `.color` assertion silently passes on ''.
 */
function withFieldConfig(series: DataFrame[], defaults: FieldConfig): DataFrame[] {
  return applyFieldOverrides({
    data: series,
    fieldConfig: { defaults, overrides: [] },
    replaceVariables: (value) => value,
    theme,
    timeZone: 'utc',
  });
}

const absoluteThresholds = {
  mode: ThresholdsMode.Absolute,
  steps: [
    { value: -Infinity, color: 'green' },
    { value: 80, color: 'red' },
  ],
};

function withThresholds(series: DataFrame[]): DataFrame[] {
  return withFieldConfig(series, { thresholds: absoluteThresholds });
}

/** `unknown` matches nothing, so it exercises the unmapped fallback. */
function withMappings(series: DataFrame[]): DataFrame[] {
  return withFieldConfig(series, {
    mappings: [
      {
        type: MappingType.ValueToText,
        options: {
          ok: { text: 'Healthy', color: 'green' },
          degraded: { text: 'Degraded', color: 'red' },
        },
      },
    ],
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

    it('renders the mapped text in place of the raw value', () => {
      expect(
        interpolate('${__data.fields.service}: ${__data.fields.state}', withMappings([services]), RenderMode.PerRow)
      ).toBe('checkout: Healthy\n\npayments: Degraded\n\nsearch: unknown');
    });

    it('colors each row from its mapping', () => {
      const colored = '<span style="color:${__data.fields.state.color}">${__data.fields.state}</span>';

      expect(interpolate(colored, withMappings([services]), RenderMode.PerRow)).toBe(
        [
          `<span style="color:${green}">Healthy</span>`,
          `<span style="color:${red}">Degraded</span>`,
          // Nothing matched, so the color comes from the field's scale instead of the mapping.
          `<span style="color:${FALLBACK_COLOR}">unknown</span>`,
        ].join('\n\n')
      );
    });

    it('prefers a mapping over the threshold for the rows it matches', () => {
      const withBoth = withFieldConfig([hosts], {
        thresholds: absoluteThresholds,
        mappings: [{ type: MappingType.RangeToText, options: { from: 80, to: 100, result: { color: 'blue' } } }],
      });
      const colored = '<span style="color:${__data.fields.cpu.color}">${__data.fields.cpu}</span>';

      // 84 is in the mapped range, so blue wins over the red threshold; 12 keeps the green one.
      expect(interpolate(colored, withBoth, RenderMode.PerRow)).toBe(
        `<span style="color:${blue}">84</span>\n\n<span style="color:${green}">12</span>`
      );
    });

    it('caps the number of rendered rows', () => {
      const big = toDataFrame({
        fields: [
          { name: 'n', type: FieldType.number, values: Array.from({ length: MAX_RENDERED_ROWS + 10 }, (_, i) => i) },
        ],
      });

      const blocks = interpolate('${__data.fields.n}', [big], RenderMode.PerRow).split('\n\n');

      expect(blocks).toHaveLength(MAX_RENDERED_ROWS + 1);
      expect(blocks[MAX_RENDERED_ROWS - 1]).toBe(String(MAX_RENDERED_ROWS - 1));
      expect(blocks[MAX_RENDERED_ROWS]).toContain(String(MAX_RENDERED_ROWS));
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
      const big = toDataFrame({
        fields: [
          { name: 'n', type: FieldType.number, values: Array.from({ length: MAX_RENDERED_ROWS + 10 }, (_, i) => i) },
        ],
      });

      // The truncation notice follows the template output as its own block.
      const [rendered] = interpolate('{{#each data}}{{n}},{{/each}}', [big], RenderMode.Once).split('\n\n');

      expect(rendered.split(',').filter(Boolean)).toHaveLength(MAX_RENDERED_ROWS);
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

    describe('truncation notice', () => {
      const big = toDataFrame({
        fields: [
          { name: 'n', type: FieldType.number, values: Array.from({ length: MAX_RENDERED_ROWS + 10 }, (_, i) => i) },
        ],
      });

      it('says so when a Once template only saw the capped rows', () => {
        expect(interpolate('{{data.length}}', [big], RenderMode.Once)).toBe(
          `${MAX_RENDERED_ROWS}\n\nShowing the first ${MAX_RENDERED_ROWS} rows.`
        );
      });

      it('is left off content that never read the rows, since nothing was truncated', () => {
        expect(interpolate('# Status', [big], RenderMode.Once)).toBe('# Status');
      });
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

  function renderMarkdownPerRow(content: string, series: DataFrame[]) {
    return renderContent(
      {
        content,
        series,
        renderMode: RenderMode.PerRow,
        mode: TextMode.Markdown,
        // What the panel passes for markdown, and it escapes what it interpolates.
        format: 'html',
      },
      createReplaceVariables(),
      false
    );
  }

  it('keeps threshold colors through markdown rendering and sanitization', () => {
    const html = renderMarkdownPerRow(
      '<span style="color:${__data.fields.cpu.color}">${__data.fields.cpu}</span>',
      withThresholds([hosts])
    );

    // The sanitizer rewrites the style attribute, adding a trailing semicolon.
    expect(html).toContain(`<span style="color:${red};">84</span>`);
    expect(html).toContain(`<span style="color:${green};">12</span>`);
  });

  it('keeps mapped text and colors through markdown rendering and sanitization', () => {
    const html = renderMarkdownPerRow(
      '<span style="color:${__data.fields.state.color}">${__data.fields.state}</span>',
      withMappings([services])
    );

    expect(html).toContain(`<span style="color:${green};">Healthy</span>`);
    expect(html).toContain(`<span style="color:${red};">Degraded</span>`);
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
