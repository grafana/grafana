import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import { type DataFrame, FieldType, type InterpolateFunction, toDataFrame } from '@grafana/data';

import { RenderMode, TextMode } from '../panelcfg.gen';

import { hasRenderableData, interpolateTemplate, MAX_RENDERED_ROWS, renderContent } from './renderContent';

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
      ['AllRows', RenderMode.AllRows],
      ['an undefined render mode', undefined],
    ])('renders the content once for %s', (_name, renderMode) => {
      expect(interpolate('CPU is ${__data.fields.cpu}%', [hosts], renderMode)).toBe('CPU is ${__data.fields.cpu}%');
    });
  });

  describe('every row', () => {
    it('repeats the content once per row, resolving fields for that row', () => {
      expect(interpolate('- ${__data.fields.host}: ${__data.fields.cpu}%', [hosts], RenderMode.EveryRow)).toBe(
        '- web-1: 84%\n\n- web-2: 12%'
      );
    });

    it('iterates every frame in series order', () => {
      expect(interpolate('${__data.fields.host}', [hosts, regions], RenderMode.EveryRow)).toBe(
        'web-1\n\nweb-2\n\ndb-1'
      );
    });

    it('resolves ${__series.name} so rows can name their frame', () => {
      expect(interpolate('${__series.name} ${__data.fields.host}', [hosts, regions], RenderMode.EveryRow)).toBe(
        'frameA web-1\n\nframeA web-2\n\nframeB db-1'
      );
    });

    it('leaves references to unknown fields empty', () => {
      expect(interpolate('[${__data.fields.nope}]', [regions], RenderMode.EveryRow)).toBe('[]');
    });

    it.each([
      ['HTML', TextMode.HTML],
      ['code', TextMode.Code],
    ])('joins rows with a single newline in %s mode', (_name, mode) => {
      expect(interpolate('${__data.fields.host}', [hosts], RenderMode.EveryRow, mode)).toBe('web-1\nweb-2');
    });

    it.each([
      ['there is no data', undefined],
      ['every frame is empty', [{ fields: [], length: 0 }]],
    ])('falls back to a single render when %s', (_name, series) => {
      expect(interpolate('CPU is ${__data.fields.cpu}%', series, RenderMode.EveryRow)).toBe(
        'CPU is ${__data.fields.cpu}%'
      );
    });

    it('caps the number of rendered rows', () => {
      const big = toDataFrame({
        fields: [
          { name: 'n', type: FieldType.number, values: Array.from({ length: MAX_RENDERED_ROWS + 10 }, (_, i) => i) },
        ],
      });

      const blocks = interpolate('${__data.fields.n}', [big], RenderMode.EveryRow).split('\n\n');

      expect(blocks).toHaveLength(MAX_RENDERED_ROWS + 1);
      expect(blocks[MAX_RENDERED_ROWS - 1]).toBe(String(MAX_RENDERED_ROWS - 1));
      expect(blocks[MAX_RENDERED_ROWS]).toContain(String(MAX_RENDERED_ROWS));
    });
  });
});

describe('renderContent', () => {
  function render(content: string, renderMode: RenderMode, mode = TextMode.Markdown) {
    return renderContent({ content, series: [hosts], renderMode, mode }, createReplaceVariables(), false);
  }

  it('renders repeated list items as a single list', () => {
    const html = render('- ${__data.fields.host}', RenderMode.EveryRow);

    // The blank line between rows makes it a loose list, so items carry a <p>.
    expect(html).toContain('<li><p>web-1</p>');
    expect(html).toContain('<li><p>web-2</p>');
    expect(html.match(/<ul>/g)).toHaveLength(1);
  });

  it('keeps each row a separate block rather than one run-on paragraph', () => {
    const html = render('${__data.fields.host}', RenderMode.EveryRow);

    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  it('leaves code mode content untransformed', () => {
    expect(render('${__data.fields.host},', RenderMode.EveryRow, TextMode.Code)).toBe('web-1,\nweb-2,');
  });

  it('sanitizes per-row HTML output', () => {
    expect(render('<b>${__data.fields.host}</b><script>alert(1)</script>', RenderMode.EveryRow, TextMode.HTML)).toBe(
      '<b>web-1</b>&lt;script&gt;alert(1)&lt;/script&gt;\n<b>web-2</b>&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });
});
