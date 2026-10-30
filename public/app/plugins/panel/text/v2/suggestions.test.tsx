import { act, render, screen } from '@testing-library/react';
import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  FieldType,
  getDefaultTimeRange,
  getPanelDataSummary,
  type InterpolateFunction,
  LoadingState,
  type PanelPluginMeta,
  PluginType,
  type PreferredVisualisationType,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  toDataFrame,
} from '@grafana/data';
import { setTemplateSrv } from '@grafana/runtime';
import { FlagKeys, setPanelPluginMetas } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { VisualizationSuggestionCard } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestionCard';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';

import { RenderMode, TextMode } from '../panelcfg.gen';

import { TextNGPanel } from './TextNGPanel';
import { MAX_RENDERED_ROWS, renderContent } from './renderContent';
import { MAX_LIST_ROWS, MAX_TEMPLATE_FIELDS, textSuggestionsSupplier } from './suggestions';
import { createData, createProps } from './test-utils';

jest.mock('./SandboxFrame');

beforeEach(() => {
  setTestFlags({ [FlagKeys.GrafanaNewTextPanel]: true, [FlagKeys.TextNewFeatures]: true });
});

afterAll(() => {
  setTestFlags({});
});

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

const SUMMARY = 'Text - summary';
const STATISTICS = 'Text - statistics';
const LIST = 'Text - list';

const theme = createTheme();
const time = { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000] };

function usage(cpu: Array<number | null> = [40, 75, null]): DataFrame {
  return toDataFrame({
    name: 'usage',
    fields: [
      time,
      { name: 'CPU', type: FieldType.number, values: cpu, config: { unit: 'percent', decimals: 1 } },
      { name: 'Memory usage', type: FieldType.number, values: [100, null, 120], config: { unit: 'bytes' } },
    ],
  });
}

function aggregate(): DataFrame {
  return toDataFrame({
    fields: [
      { name: 'region', type: FieldType.string, values: ['eu'] },
      { name: 'latency', type: FieldType.number, values: [120], config: { unit: 'ms' } },
      { name: 'requests', type: FieldType.number, values: [42] },
    ],
  });
}

function hostUsage(): DataFrame {
  return toDataFrame({
    fields: [
      time,
      { name: 'Host', type: FieldType.string, values: ['web-01', 'web-01', 'web-02'] },
      { name: 'CPU', type: FieldType.number, values: [40, 60, 75], config: { unit: 'percent', decimals: 1 } },
    ],
  });
}

function services(
  names: Array<string | null> = ['API', 'Worker', 'Web'],
  availability: number[] = [99.9, 97.5, 100]
): DataFrame {
  return toDataFrame({
    fields: [
      { name: 'Service', type: FieldType.string, values: names },
      { name: 'Availability', type: FieldType.number, values: availability, config: { unit: 'percent' } },
    ],
  });
}

function affectedServices(): DataFrame {
  return toDataFrame({
    fields: [{ name: 'Affected service', type: FieldType.string, values: ['checkout', 'payments', 'notifications'] }],
  });
}

function numberFields(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `cpu${index}`,
    type: FieldType.number,
    values: [1, 2, 3],
  }));
}

function withDisplay(frames: DataFrame[], defaults = {}): DataFrame[] {
  return applyFieldOverrides({
    data: frames,
    fieldConfig: { defaults, overrides: [] },
    replaceVariables: (value) => value,
    theme,
    timeZone: 'utc',
  });
}

function createReplaceVariables(): InterpolateFunction {
  const templateSrv = initTemplateSrv('text-suggestions', [
    { type: 'constant', name: 'host', current: { value: 'web-1', text: 'web-1' } },
  ]);
  return (target, scopedVars, format) => templateSrv.replace(target, scopedVars, format);
}

function suggest(frames?: DataFrame[]) {
  return textSuggestionsSupplier(getPanelDataSummary(frames));
}

function getOptions(name: string, frames: DataFrame[]) {
  const options = suggest(frames)?.find((suggestion) => suggestion.name === name)?.options;
  if (!options) {
    throw new Error(`no ${name} suggestion`);
  }
  return options;
}

function itemLines(name: string, frames: DataFrame[]) {
  return (getOptions(name, frames).content ?? '').split('\n').filter((line) => line.startsWith('- '));
}

function renderTemplate(name: string, frames: DataFrame[], series = frames, renderMode?: RenderMode) {
  const options = getOptions(name, frames);
  return renderContent(
    {
      content: options.content ?? '',
      mode: TextMode.Markdown,
      series,
      renderMode: renderMode ?? options.renderMode,
      format: 'html',
    },
    createReplaceVariables(),
    false
  );
}

function renderSuggestion(name: string, frames: DataFrame[], series = frames, renderMode?: RenderMode) {
  const container = document.createElement('div');
  container.innerHTML = renderTemplate(name, frames, series, renderMode).content;
  return container;
}

function listItems(container: HTMLElement) {
  return Array.from(container.querySelectorAll('li'), (item) => item.textContent?.trim());
}

function tableRows(container: HTMLElement) {
  return Array.from(container.querySelectorAll('tr'), (row) =>
    Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent)
  );
}

function panelMeta(id: string, sort: number): PanelPluginMeta {
  return {
    id,
    name: id,
    type: PluginType.panel,
    module: `core:plugin/${id}`,
    baseUrl: `public/app/plugins/panel/${id}`,
    sort,
    hideFromList: false,
    suggestions: true,
    info: {
      author: { name: 'Grafana Labs' },
      description: id,
      links: [],
      logos: { small: '', large: '' },
      screenshots: [],
      updated: '',
      version: '',
    },
  };
}

describe('textSuggestionsSupplier', () => {
  describe('eligibility', () => {
    it.each([
      { name: 'no series at all', frames: undefined },
      { name: 'no frames', frames: [] },
      {
        name: 'a frame without rows',
        frames: [
          toDataFrame({
            fields: [
              { ...time, values: [] },
              { name: 'CPU', type: FieldType.number, values: [] },
            ],
          }),
        ],
      },
      { name: 'several frames', frames: [usage(), usage()] },
      {
        name: 'a time series without numeric fields',
        frames: [toDataFrame({ fields: [time, { name: 'host', type: FieldType.string, values: ['a', 'b', 'c'] }] })],
      },
      {
        name: 'a frame with neither numbers nor strings',
        frames: [toDataFrame({ fields: [time, { name: 'up', type: FieldType.boolean, values: [true, false, true] }] })],
      },
      {
        name: `a table of more than ${MAX_LIST_ROWS} rows`,
        frames: [
          services(
            Array.from({ length: MAX_LIST_ROWS + 1 }, (_, index) => `service-${index}`),
            Array.from({ length: MAX_LIST_ROWS + 1 }, () => 99)
          ),
        ],
      },
    ])('offers nothing for $name', ({ frames }) => {
      expect(suggest(frames)).toBeUndefined();
    });

    it.each([
      { name: 'a time series', frames: [usage()], expected: [SUMMARY, STATISTICS] },
      {
        name: 'numeric samples without a time field',
        frames: [toDataFrame({ fields: [{ name: 'Queue depth', type: FieldType.number, values: [12, 18, 7] }] })],
        expected: [SUMMARY, STATISTICS],
      },
      { name: 'a time series with a string dimension', frames: [hostUsage()], expected: [SUMMARY, STATISTICS] },
      { name: 'a single row, where every statistic is the same value', frames: [aggregate()], expected: [SUMMARY] },
      {
        name: 'a single string value',
        frames: [toDataFrame({ fields: [{ name: 'Deployment status', type: FieldType.string, values: ['Healthy'] }] })],
        expected: [SUMMARY],
      },
      {
        name: 'a time series without a value yet',
        frames: [toDataFrame({ fields: [time, { name: 'CPU', type: FieldType.number, values: [null, NaN, null] }] })],
        expected: [SUMMARY],
      },
      { name: 'a value per category', frames: [services()], expected: [LIST] },
      {
        name: 'an instant query with a row per series',
        frames: [
          toDataFrame({
            fields: [
              { ...time, values: [3000, 3000, 3000] },
              { name: 'instance', type: FieldType.string, values: ['web-1', 'web-2', 'web-3'] },
              { name: 'Value', type: FieldType.number, values: [1, 0, 1] },
            ],
          }),
        ],
        expected: [LIST],
      },
      { name: 'a list of strings', frames: [affectedServices()], expected: [LIST] },
      {
        name: `a table of exactly ${MAX_LIST_ROWS} rows`,
        frames: [
          services(
            Array.from({ length: MAX_LIST_ROWS }, (_, index) => `service-${index}`),
            Array.from({ length: MAX_LIST_ROWS }, () => 99)
          ),
        ],
        expected: [LIST],
      },
    ])('offers $expected for $name', ({ frames, expected }) => {
      expect(suggest(frames)?.map(({ name }) => name)).toEqual(expected);
    });

    it.each<PreferredVisualisationType>(['logs', 'trace', 'nodeGraph', 'flamegraph'])(
      'offers nothing for data that prefers the %s visualization',
      (preferredVisualisationType) => {
        expect(suggest([{ ...services(), meta: { preferredVisualisationType } }])).toBeUndefined();
      }
    );

    it('offers nothing when the text.newFeatures flag is off', () => {
      setTestFlags({ [FlagKeys.GrafanaNewTextPanel]: true, [FlagKeys.TextNewFeatures]: false });

      expect(suggest([usage()])).toBeUndefined();
    });
  });

  describe('generated panel', () => {
    it('renders the summary and the statistics once, and the list per row, all as markdown', () => {
      expect(
        [usage(), services()].flatMap((frame) =>
          (suggest([frame]) ?? []).map(({ name, options }) => [name, options?.mode, options?.renderMode])
        )
      ).toEqual([
        [SUMMARY, TextMode.Markdown, RenderMode.Once],
        [STATISTICS, TextMode.Markdown, RenderMode.Once],
        [LIST, TextMode.Markdown, RenderMode.PerRow],
      ]);
    });

    it('binds the summary to the last non-null value of each numeric field', () => {
      expect(getOptions(SUMMARY, [usage()]).content).toBe(
        [
          '{{#if (eq frames.length 0)}}',
          'No data',
          '{{else}}',
          '- **CPU**: ${__data.fields.CPU:reduce:lastNotNull}',
          '- **Memory usage**: ${__data.fields["Memory usage"]:reduce:lastNotNull}',
          '{{/if}}',
        ].join('\n')
      );
    });

    it('binds the statistics table to the last, min, mean and max of each numeric field', () => {
      expect(getOptions(STATISTICS, [usage()]).content).toBe(
        [
          '{{#if (eq frames.length 0)}}',
          'No data',
          '{{else}}',
          '| Field | Last | Min | Mean | Max |',
          '| --- | ---: | ---: | ---: | ---: |',
          '| CPU | ${__data.fields.CPU:reduce:lastNotNull} | ${__data.fields.CPU:reduce:min} | ${__data.fields.CPU:reduce:mean} | ${__data.fields.CPU:reduce:max} |',
          '| Memory usage | ${__data.fields["Memory usage"]:reduce:lastNotNull} | ${__data.fields["Memory usage"]:reduce:min} | ${__data.fields["Memory usage"]:reduce:mean} | ${__data.fields["Memory usage"]:reduce:max} |',
          '{{/if}}',
        ].join('\n')
      );
    });

    it('keeps the string dimension of a time series in the summary, but not in the statistics', () => {
      expect(itemLines(SUMMARY, [hostUsage()])).toEqual([
        '- **Host**: ${__data.fields.Host:reduce:lastNotNull}',
        '- **CPU**: ${__data.fields.CPU:reduce:lastNotNull}',
      ]);
      expect(getOptions(STATISTICS, [hostUsage()]).content?.split('\n').slice(3, -1)).toEqual([
        '| Field | Last | Min | Mean | Max |',
        '| --- | ---: | ---: | ---: | ---: |',
        '| CPU | ${__data.fields.CPU:reduce:lastNotNull} | ${__data.fields.CPU:reduce:min} | ${__data.fields.CPU:reduce:mean} | ${__data.fields.CPU:reduce:max} |',
      ]);
    });

    it('binds the list to each row, labelled by its first string field', () => {
      expect(getOptions(LIST, [services()]).content).toBe(
        [
          '{{#if (eq data.length 0)}}',
          'No data',
          '{{else}}',
          '- <strong>${__data.fields.Service}</strong>: ${__data.fields.Availability}',
          '{{/if}}',
        ].join('\n')
      );
    });

    it.each([
      {
        name: 'a single string field',
        fields: [{ name: 'host', type: FieldType.string, values: ['a', 'b'] }],
        item: '- <span>${__data.fields.host}</span>',
      },
      {
        name: 'a label after a number',
        fields: [
          { name: 'requests', type: FieldType.number, values: [1, 2] },
          { name: 'host', type: FieldType.string, values: ['a', 'b'] },
        ],
        item: '- <strong>${__data.fields.host}</strong>: ${__data.fields.requests}',
      },
      {
        name: 'a series of an instant query, without its timestamp',
        fields: [
          { ...time, values: [3000, 3000] },
          { name: 'instance', type: FieldType.string, values: ['web-1', 'web-2'] },
          { name: 'Value', type: FieldType.number, values: [1, 0] },
        ],
        item: '- <strong>${__data.fields.instance}</strong>: ${__data.fields.Value}',
      },
      {
        name: 'several values, each named',
        fields: [
          { name: 'host', type: FieldType.string, values: ['a', 'b'] },
          { name: 'region', type: FieldType.string, values: ['eu', 'us'] },
          { name: 'p95 *latency*', type: FieldType.number, values: [120, 80] },
        ],
        item: '- <strong>${__data.fields.host}</strong>: region ${__data.fields.region}, p95 \\*latency\\* ${__data.fields["p95 *latency*"]}',
      },
    ])('lists $name per row', ({ fields, item }) => {
      expect(itemLines(LIST, [toDataFrame({ fields })])).toEqual([item]);
    });

    it.each([
      {
        name: 'a plain name',
        field: 'cpu_total',
        content: '- **cpu_total**: ${__data.fields.cpu_total:reduce:lastNotNull}',
      },
      {
        name: 'a name with spaces and dots',
        field: 'cpu.usage %',
        content: '- **cpu.usage %**: ${__data.fields["cpu.usage %"]:reduce:lastNotNull}',
      },
      {
        name: 'a name with a colon',
        field: 'job:cpu:rate5m',
        content: '- **job:cpu:rate5m**: ${__data.fields["job:cpu:rate5m"]:reduce:lastNotNull}',
      },
      {
        name: 'a name with a quote',
        field: 'say "hi"',
        content: '- **say "hi"**: ${__data.fields[1]:reduce:lastNotNull}',
      },
      {
        name: 'a name with braces',
        field: '{{cpu}}',
        content: '- **\\{\\{cpu}}**: ${__data.fields[1]:reduce:lastNotNull}',
      },
      {
        name: 'a name that opens an HTML comment',
        field: '<!-- cpu',
        content: '- **&lt;!-- cpu**: ${__data.fields[1]:reduce:lastNotNull}',
      },
    ])('binds $name by a path the reducer macro can read', ({ field, content }) => {
      const frames = [toDataFrame({ fields: [time, { name: field, type: FieldType.number, values: [1, 2, 3] }] })];

      expect(itemLines(SUMMARY, frames)).toEqual([content]);
      expect(listItems(renderSuggestion(SUMMARY, withDisplay(frames)))).toEqual([`${field}: 3`]);
    });

    it.each([
      { name: 'a plain name', field: 'service', path: '.service' },
      { name: 'a name with spaces', field: 'Affected service', path: '["Affected service"]' },
      { name: 'a name with a colon', field: 'job:service', path: '[0]' },
      { name: 'a name with a caret', field: 'service^2', path: '[0]' },
      { name: 'a name with a closing brace', field: 'service}', path: '[0]' },
    ])('binds $name by a path the row macro can read', ({ field, path }) => {
      const frames = [
        toDataFrame({
          fields: [
            { name: field, type: FieldType.string, values: ['API', 'Web'] },
            { name: 'Availability', type: FieldType.number, values: [99.9, 100] },
          ],
        }),
      ];

      expect(itemLines(LIST, frames)).toEqual([
        `- <strong>\${__data.fields${path}}</strong>: \${__data.fields.Availability}`,
      ]);
      expect(listItems(renderSuggestion(LIST, withDisplay(frames)))).toEqual(['API: 99.9', 'Web: 100']);
    });

    it('binds fields that share a name by their index', () => {
      const frames = [
        toDataFrame({
          fields: [
            time,
            { name: 'Value', type: FieldType.number, values: [1, 2, 3], labels: { host: 'a' } },
            { name: 'Value', type: FieldType.number, values: [4, 5, 6], labels: { host: 'b' } },
          ],
        }),
      ];

      expect(itemLines(SUMMARY, frames)).toEqual([
        '- **a**: ${__data.fields[1]:reduce:lastNotNull}',
        '- **b**: ${__data.fields[2]:reduce:lastNotNull}',
      ]);
      expect(listItems(renderSuggestion(SUMMARY, withDisplay(frames)))).toEqual(['a: 3', 'b: 6']);
    });

    it('offers nothing when a field index is also the name of another field', () => {
      const frame = toDataFrame({
        fields: [
          time,
          { name: 'Value', type: FieldType.number, values: [1, 2, 3] },
          { name: 'Value', type: FieldType.number, values: [4, 5, 6] },
          { name: '2', type: FieldType.number, values: [7, 8, 9] },
        ],
      });

      expect(suggest([frame])).toBeUndefined();
    });

    it('offers no list for a field displayed as data, which would shadow the row count the list checks', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'data', type: FieldType.string, values: ['', 'x'] },
          { name: 'Availability', type: FieldType.number, values: [99.9, 100] },
        ],
      });

      expect(suggest([frame])).toBeUndefined();
    });

    it(`lists every field of a frame with exactly ${MAX_TEMPLATE_FIELDS} numeric fields`, () => {
      const frames = [toDataFrame({ fields: [time, ...numberFields(MAX_TEMPLATE_FIELDS)] })];

      expect(itemLines(SUMMARY, frames).at(-1)).toBe('- **cpu49**: ${__data.fields.cpu49:reduce:lastNotNull}');
      expect(getOptions(STATISTICS, frames).content?.split('\n').at(-2)).toBe(
        '| cpu49 | ${__data.fields.cpu49:reduce:lastNotNull} | ${__data.fields.cpu49:reduce:min} | ${__data.fields.cpu49:reduce:mean} | ${__data.fields.cpu49:reduce:max} |'
      );
    });

    it(`lists the first ${MAX_TEMPLATE_FIELDS} fields of a wider frame, rather than offering nothing`, () => {
      const frames = [toDataFrame({ fields: [time, ...numberFields(MAX_TEMPLATE_FIELDS + 1)] })];
      const summary = itemLines(SUMMARY, frames);

      expect(summary).toHaveLength(MAX_TEMPLATE_FIELDS);
      expect(summary.at(-1)).toBe('- **cpu49**: ${__data.fields.cpu49:reduce:lastNotNull}');
      expect(getOptions(STATISTICS, frames).content?.split('\n').at(-2)).toMatch(/^\| cpu49 \|/);
    });
  });
});

describe('generated templates', () => {
  it('render the summary with each field formatted by its own config', () => {
    expect(listItems(renderSuggestion(SUMMARY, withDisplay([usage()])))).toEqual(['CPU: 75.0%', 'Memory usage: 120 B']);
  });

  it('render the statistics table with every reducer formatted by the field config', () => {
    expect(tableRows(renderSuggestion(STATISTICS, withDisplay([usage()])))).toEqual([
      ['Field', 'Last', 'Min', 'Mean', 'Max'],
      ['CPU', '75.0%', '40.0%', '57.5%', '75.0%'],
      ['Memory usage', '120 B', '100 B', '110 B', '120 B'],
    ]);
  });

  it('render a single row result as its values', () => {
    expect(listItems(renderSuggestion(SUMMARY, withDisplay([aggregate()])))).toEqual([
      'region: eu',
      'latency: 120 ms',
      'requests: 42',
    ]);
  });

  it('render the summary of a time series with the last value of its string dimension', () => {
    expect(listItems(renderSuggestion(SUMMARY, withDisplay([hostUsage()])))).toEqual(['Host: web-02', 'CPU: 75.0%']);
  });

  it('render the statistics of numeric samples that have no time field', () => {
    const frames = withDisplay([
      toDataFrame({ fields: [{ name: 'Queue depth', type: FieldType.number, values: [12, 18, 7] }] }),
    ]);

    expect(tableRows(renderSuggestion(STATISTICS, frames))[1]).toEqual(['Queue depth', '7', '7', '12.3', '18']);
  });

  it('render a field without any value as the No value of its field config', () => {
    const frames = [
      toDataFrame({ fields: [time, { name: 'CPU', type: FieldType.number, values: [null, null, null] }] }),
    ];

    expect(listItems(renderSuggestion(SUMMARY, withDisplay(frames, { noValue: 'No reading' })))).toEqual([
      'CPU: No reading',
    ]);
  });

  it('render the list with one item per row, formatted by the field config', () => {
    expect(listItems(renderSuggestion(LIST, withDisplay([services()])))).toEqual([
      'API: 99.9%',
      'Worker: 97.5%',
      'Web: 100%',
    ]);
  });

  it('render a list of strings with every row', () => {
    expect(listItems(renderSuggestion(LIST, withDisplay([affectedServices()])))).toEqual([
      'checkout',
      'payments',
      'notifications',
    ]);
  });

  it('render list values that read as markdown blocks as plain text', () => {
    const values = ['-', '> 5 min', '1. P1', '# 2', '```'];
    const frames = withDisplay([
      toDataFrame({ fields: [{ name: 'Affected service', type: FieldType.string, values }] }),
    ]);

    expect(listItems(renderSuggestion(LIST, frames))).toEqual(values);
  });

  it('render a list row without a label as its value alone', () => {
    expect(listItems(renderSuggestion(LIST, withDisplay([services(['API', null, ' '])])))).toEqual([
      'API: 99.9%',
      ': 97.5%',
      ': 100%',
    ]);
  });

  it('render list values verbatim, neither interpolated nor read as HTML', () => {
    const label = '$host ${__series.name} <b>bold</b>';

    expect(listItems(renderSuggestion(LIST, withDisplay([services([label, 'Web'], [99.9, 100])])))).toEqual([
      `${label}: 99.9%`,
      'Web: 100%',
    ]);
  });

  it.each([
    { name: 'no frames', series: [] },
    {
      name: 'a frame without rows',
      series: [
        toDataFrame({
          fields: [
            { name: 'Service', type: FieldType.string, values: [] },
            { name: 'Availability', type: FieldType.number, values: [] },
          ],
        }),
      ],
    },
  ])('render the list as No data once the query returns $name', ({ series }) => {
    const container = renderSuggestion(LIST, withDisplay([services()]), series);

    expect(container.textContent?.trim()).toBe('No data');
  });

  it.each([SUMMARY, STATISTICS])('render %s as No data once the query returns no frames', (name) => {
    const container = renderSuggestion(name, withDisplay([usage()]), []);

    expect(container.textContent?.trim()).toBe('No data');
  });

  it('render the summary on every row, not No data, once switched to Per row', () => {
    const frames = withDisplay([usage()]);
    const container = renderSuggestion(SUMMARY, frames, frames, RenderMode.PerRow);

    expect(listItems(container)).toEqual([
      'CPU: 75.0%',
      'Memory usage: 120 B',
      'CPU: 75.0%',
      'Memory usage: 120 B',
      'CPU: 75.0%',
      'Memory usage: 120 B',
    ]);
  });

  it('read no rows to stay bound, so a long series is not reported as truncated', () => {
    const length = MAX_RENDERED_ROWS + 1;
    const frames = [
      toDataFrame({
        fields: [
          { ...time, values: Array.from({ length }, (_, index) => index) },
          { name: 'CPU', type: FieldType.number, values: Array.from({ length }, (_, index) => index) },
        ],
      }),
    ];
    const rendered = renderTemplate(SUMMARY, withDisplay(frames));
    const container = document.createElement('div');
    container.innerHTML = rendered.content;

    expect(listItems(container)).toEqual(['CPU: 1000']);
    expect(rendered.truncated).toBe(false);
  });

  describe('with a field name that reads as markdown, a variable and a template', () => {
    const name = '*bold* _it_ [x](y) <i>z</i> |p| ~s~ & $host ${__series.name} {{data.length}} \\e';
    const frames = () =>
      withDisplay([
        toDataFrame({ name: 'usage', fields: [time, { name, type: FieldType.number, values: [1, 2, 7] }] }),
      ]);

    it('shows the name verbatim as the summary label', () => {
      expect(listItems(renderSuggestion(SUMMARY, frames()))).toEqual([`${name}: 7`]);
    });

    it('keeps the name in a single statistics cell', () => {
      expect(tableRows(renderSuggestion(STATISTICS, frames()))[1]).toEqual([name, '7', '1', '3.33', '7']);
    });

    it('shows the name verbatim before its value in a list row', () => {
      const rows = withDisplay([
        toDataFrame({
          fields: [
            { name: 'host', type: FieldType.string, values: ['a', 'b'] },
            { name: 'region', type: FieldType.string, values: ['eu', 'us'] },
            { name, type: FieldType.number, values: [7, 8] },
          ],
        }),
      ]);

      expect(listItems(renderSuggestion(LIST, rows))).toEqual([`a: region eu, ${name} 7`, `b: region us, ${name} 8`]);
    });
  });

  it('show a URL, a www address and an email in a field name as text, not links', () => {
    const name = 'see https://grafana.com, www.grafana.com or ops@grafana.com';
    const container = renderSuggestion(
      SUMMARY,
      withDisplay([toDataFrame({ fields: [time, { name, type: FieldType.number, values: [1, 2, 7] }] })])
    );

    expect(listItems(container)).toEqual([`${name}: 7`]);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});

describe('an applied suggestion', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps its values in step with new query data', () => {
    const props = createProps(createReplaceVariables(), {
      data: createData(withDisplay([usage()])),
      options: getOptions(SUMMARY, [usage()]),
    });

    const { rerender } = render(<TextNGPanel {...props} />);

    expect(listItems(screen.getByTestId('TextNGPanel-converted-content'))).toEqual([
      'CPU: 75.0%',
      'Memory usage: 120 B',
    ]);

    rerender(<TextNGPanel {...props} data={createData(withDisplay([usage([40, 75, 90])]))} />);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(listItems(screen.getByTestId('TextNGPanel-converted-content'))).toEqual([
      'CPU: 90.0%',
      'Memory usage: 120 B',
    ]);
  });

  it('keeps one list item per row as the rows change', () => {
    const props = createProps(createReplaceVariables(), {
      data: createData(withDisplay([services()])),
      options: getOptions(LIST, [services()]),
    });

    const { rerender } = render(<TextNGPanel {...props} />);

    expect(listItems(screen.getByTestId('TextNGPanel-converted-content'))).toEqual([
      'API: 99.9%',
      'Worker: 97.5%',
      'Web: 100%',
    ]);

    rerender(<TextNGPanel {...props} data={createData(withDisplay([services(['API', 'Web'], [99.5, 98])]))} />);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(listItems(screen.getByTestId('TextNGPanel-converted-content'))).toEqual(['API: 99.5%', 'Web: 98%']);
  });
});

describe('among the other visualization suggestions', () => {
  beforeAll(() => {
    setPanelPluginMetas({
      timeseries: panelMeta('timeseries', 1),
      stat: panelMeta('stat', 3),
      table: panelMeta('table', 6),
      text: panelMeta('text', 14),
    });
    setTemplateSrv(initTemplateSrv('text-suggestions-picker', []));
  });

  it('lists the Text suggestions after the established panels, so a new panel never defaults to Text', async () => {
    const { suggestions } = await getAllSuggestions([usage()]);

    expect(suggestions[0].pluginId).toBe('timeseries');
    expect(suggestions.slice(-2).map(({ pluginId, name }) => `${pluginId}: ${name}`)).toEqual([
      `text: ${SUMMARY}`,
      `text: ${STATISTICS}`,
    ]);
  });

  it('lists the Text list after the established panels for a value per category', async () => {
    const { suggestions } = await getAllSuggestions([services()]);

    expect(suggestions[0].pluginId).toBe('stat');
    expect(suggestions.at(-1)).toMatchObject({ pluginId: 'text', name: LIST });
  });

  it('previews the summary with each field and its current value', async () => {
    const { suggestions } = await getAllSuggestions([usage()]);
    const summary = suggestions.find(({ name }) => name === SUMMARY);
    if (!summary) {
      throw new Error('no summary suggestion');
    }

    render(
      <VisualizationSuggestionCard
        data={{ series: [usage()], state: LoadingState.Done, timeRange: getDefaultTimeRange() }}
        suggestion={summary}
        width={200}
      />
    );

    expect(listItems(await screen.findByTestId('TextNGPanel-converted-content'))).toEqual([
      'CPU: 75.0%',
      'Memory usage: 120 B',
    ]);
  });

  it('previews the list with every row', async () => {
    const { suggestions } = await getAllSuggestions([services()]);
    const list = suggestions.find(({ name }) => name === LIST);
    if (!list) {
      throw new Error('no list suggestion');
    }

    render(
      <VisualizationSuggestionCard
        data={{ series: [services()], state: LoadingState.Done, timeRange: getDefaultTimeRange() }}
        suggestion={list}
        width={200}
      />
    );

    expect(listItems(await screen.findByTestId('TextNGPanel-converted-content'))).toEqual([
      'API: 99.9%',
      'Worker: 97.5%',
      'Web: 100%',
    ]);
  });
});
