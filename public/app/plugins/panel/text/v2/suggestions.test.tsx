import { act, render, screen, waitFor } from '@testing-library/react';
import { lastValueFrom } from 'rxjs';
import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  DataTransformerID,
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
  transformDataFrame,
} from '@grafana/data';
import { mergeTransformer, mockTransformationsRegistry, sortByTransformer } from '@grafana/data/internal';
import { setTemplateSrv } from '@grafana/runtime';
import { FlagKeys, setPanelPluginMetas } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { VisualizationSuggestionCard } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestionCard';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';

import { RenderMode, TextMode } from '../panelcfg.gen';

import { TextNGPanel } from './TextNGPanel';
import { MAX_RENDERED_ROWS, renderContent } from './renderContent';
import { MAX_LIST_ROWS, MAX_MERGED_FRAMES, MAX_TEMPLATE_FIELDS, textSuggestionsSupplier } from './suggestions';
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
mockTransformationsRegistry([mergeTransformer, sortByTransformer]);

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

function timeSeries(name: string, values: Array<number | null> = [1, 2, 3], config = {}): DataFrame {
  return toDataFrame({ fields: [time, { name, type: FieldType.number, values, config }] });
}

function queries(): DataFrame[] {
  return [
    timeSeries('CPU', [40, 75, null], { unit: 'percent', decimals: 1 }),
    timeSeries('Memory', [35, 45, 65], { unit: 'bytes' }),
  ];
}

function labelled(name: string, labels: Record<string, string>): DataFrame {
  return toDataFrame({ fields: [time, { name, type: FieldType.number, values: [1, 2, 3], labels }] });
}

function sampledAt(times: number[], name: string, values: number[], timeConfig = {}): DataFrame {
  return toDataFrame({
    fields: [
      { ...time, values: times, config: timeConfig },
      { name, type: FieldType.number, values },
    ],
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

/** What a panel with this suggestion applied receives for `series`: its transformations' real output. */
function transformedData(name: string, frames: DataFrame[], series = frames) {
  const transformations = suggest(frames)?.find((suggestion) => suggestion.name === name)?.transformations ?? [];

  return lastValueFrom(transformDataFrame(transformations, series));
}

async function appliedData(name: string, frames: DataFrame[], series = frames) {
  return withDisplay(await transformedData(name, frames, series));
}

async function renderMerged(name: string, frames: DataFrame[], series = frames) {
  return renderSuggestion(name, frames, await appliedData(name, frames, series));
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
      { name: 'several frames whose series share a name', frames: [usage(), usage()] },
      {
        name: 'several frames told apart only by labels, which Merge would collapse',
        frames: [labelled('Value', { host: 'web-1' }), labelled('Value', { host: 'web-2' })],
      },
      {
        name: 'several frames with distinct names whose labels Merge would drop',
        frames: [labelled('CPU', { host: 'web-1' }), labelled('Memory', { host: 'web-2' })],
      },
      {
        name: 'several frames told apart by frame names, which Merge would drop',
        frames: [
          { ...timeSeries('CPU'), name: 'web' },
          { ...timeSeries('Memory'), name: 'db' },
        ],
      },
      {
        name: 'a series renamed by a display name, which Merge would drop',
        frames: [timeSeries('CPU', [1, 2, 3], { displayName: 'Processor' }), timeSeries('Memory')],
      },
      {
        name: 'several series the data source displays under one name',
        frames: [
          timeSeries('a', [1, 2, 3], { displayNameFromDS: 'CPU' }),
          timeSeries('b', [1, 2, 3], { displayNameFromDS: 'CPU' }),
        ],
      },
      {
        name: 'a series displayed under the name of the time field, which Sort by could sort by instead',
        frames: [timeSeries('a', [1, 2, 3], { displayNameFromDS: 'Time' }), timeSeries('Memory')],
      },
      {
        name: 'a field of another type displayed under the name of the time field, for the same reason',
        frames: [
          toDataFrame({
            fields: [
              {
                name: 'up',
                type: FieldType.boolean,
                values: [true, false, true],
                config: { displayNameFromDS: 'Time' },
              },
              time,
              { name: 'CPU', type: FieldType.number, values: [1, 2, 3] },
            ],
          }),
          timeSeries('Memory'),
        ],
      },
      {
        name: 'several frames without a time field, which Merge would leave apart',
        frames: [
          toDataFrame({ fields: [{ name: 'CPU', type: FieldType.number, values: [1, 2] }] }),
          toDataFrame({ fields: [{ name: 'Memory', type: FieldType.number, values: [3, 4] }] }),
        ],
      },
      {
        name: 'several frames whose time fields have different names, which Merge would leave apart',
        frames: [
          timeSeries('CPU'),
          toDataFrame({
            fields: [
              { ...time, name: 'time' },
              { name: 'Memory', type: FieldType.number, values: [1, 2, 3] },
            ],
          }),
        ],
      },
      {
        name: 'several frames where only some have the time field',
        frames: [
          timeSeries('CPU'),
          timeSeries('Memory'),
          toDataFrame({ fields: [{ name: 'Disk', type: FieldType.number, values: [1, 2, 3] }] }),
        ],
      },
      {
        name: 'several frames joined on a number rather than a time field',
        frames: [
          toDataFrame({
            fields: [
              { name: 'id', type: FieldType.number, values: [1, 2] },
              { name: 'CPU', type: FieldType.number, values: [3, 4] },
            ],
          }),
          toDataFrame({
            fields: [
              { name: 'id', type: FieldType.number, values: [1, 2] },
              { name: 'Memory', type: FieldType.number, values: [5, 6] },
            ],
          }),
        ],
      },
      {
        name: 'several frames sharing a string field, which Merge would collapse',
        frames: [
          hostUsage(),
          toDataFrame({
            fields: [
              time,
              { name: 'Host', type: FieldType.string, values: ['web-01', 'web-01', 'web-02'] },
              { name: 'Memory', type: FieldType.number, values: [1, 2, 3] },
            ],
          }),
        ],
      },
      {
        name: 'several frames sharing a second time field',
        frames: ['CPU', 'Memory'].map((name) =>
          toDataFrame({
            fields: [time, { ...time, name: 'End' }, { name, type: FieldType.number, values: [1, 2, 3] }],
          })
        ),
      },
      {
        name: 'a frame that repeats a timestamp, as Merge would copy the other series onto each of its rows',
        frames: [sampledAt([1000, 1000, 2000], 'CPU', [1, 2, 3]), sampledAt([1000, 2000], 'Memory', [10, 20])],
      },
      { name: 'several frames with a table among them', frames: [timeSeries('CPU'), services()] },
      {
        name: 'several frames with a series name that no quotes can hold',
        frames: [timeSeries(`it's "cpu"`), timeSeries('Memory')],
      },
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
      {
        name: 'a time series with one value, where every statistic is the same value',
        frames: [toDataFrame({ fields: [time, { name: 'CPU', type: FieldType.number, values: [null, 7, null] }] })],
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
      { name: 'two queries', frames: queries(), expected: [SUMMARY, STATISTICS] },
      {
        name: 'several series from one query',
        frames: ['A-series', 'A-series1', 'A-series2'].map((name) => timeSeries(name)),
        expected: [SUMMARY, STATISTICS],
      },
      {
        name: 'an instant query with a frame per series',
        frames: ['web-1', 'web-2'].map((name) =>
          toDataFrame({
            fields: [
              { ...time, values: [3000] },
              { name, type: FieldType.number, values: [1] },
            ],
          })
        ),
        expected: [SUMMARY],
      },
      {
        name: 'several frames with one value each, at different times',
        frames: [sampledAt([1000], 'CPU', [1]), sampledAt([2000], 'Memory', [2])],
        expected: [SUMMARY],
      },
      {
        name: 'several frames whose timestamps only partly match',
        frames: [sampledAt([1000, 3000], 'CPU', [1, 3]), sampledAt([1000, 2000, 3000], 'Memory', [10, 20, 30])],
        expected: [SUMMARY, STATISTICS],
      },
      {
        name: 'several frames with a frame that has no fields, as a query without results returns',
        frames: [toDataFrame({ fields: [] }), timeSeries('CPU')],
        expected: [SUMMARY, STATISTICS],
      },
      {
        name: 'several frames with a string dimension of their own',
        frames: [
          hostUsage(),
          toDataFrame({
            fields: [
              time,
              { name: 'Region', type: FieldType.string, values: ['eu', 'eu', 'us'] },
              { name: 'Memory', type: FieldType.number, values: [1, 2, 3] },
            ],
          }),
        ],
        expected: [SUMMARY, STATISTICS],
      },
      {
        name: 'several series named by the data source, as Merge keeps that name',
        frames: [
          timeSeries('a', [1, 2, 3], { displayNameFromDS: 'CPU' }),
          timeSeries('b', [1, 2, 3], { displayNameFromDS: 'Memory' }),
        ],
        expected: [SUMMARY, STATISTICS],
      },
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

    it('binds each series of several frames to the field it becomes once merged', () => {
      expect(getOptions(SUMMARY, queries()).content).toBe(
        [
          '{{#if (eq frames.length 0)}}',
          'No data',
          '{{else}}',
          '- **CPU**: ${__data.fields.CPU:reduce:lastNotNull}',
          '- **Memory**: ${__data.fields.Memory:reduce:lastNotNull}',
          '{{/if}}',
        ].join('\n')
      );
      expect(getOptions(STATISTICS, queries()).content?.split('\n').at(-2)).toBe(
        '| Memory | ${__data.fields.Memory:reduce:lastNotNull} | ${__data.fields.Memory:reduce:min} | ${__data.fields.Memory:reduce:mean} | ${__data.fields.Memory:reduce:max} |'
      );
    });

    it('quotes the name of a series that is not an identifier', () => {
      const frames = ['A-series', 'A-series1'].map((name) => timeSeries(name));

      expect(itemLines(SUMMARY, frames)).toEqual([
        '- **A-series**: ${__data.fields["A-series"]:reduce:lastNotNull}',
        '- **A-series1**: ${__data.fields["A-series1"]:reduce:lastNotNull}',
      ]);
    });

    it('merges several frames, then sorts by the time field they share', () => {
      const transformations = [
        { id: DataTransformerID.merge, options: {} },
        { id: DataTransformerID.sortBy, options: { sort: [{ field: 'Time' }] } },
      ];

      expect(suggest(queries())?.map((suggestion) => suggestion.transformations)).toEqual([
        transformations,
        transformations,
      ]);
    });

    it('sorts by the name the data source gives the time field, as that is what Sort by matches', () => {
      const frames = ['CPU', 'Memory'].map((name) =>
        sampledAt([1000, 2000], name, [1, 2], { displayNameFromDS: 'Timestamp' })
      );

      expect(suggest(frames)?.map(({ transformations }) => transformations?.[1].options)).toEqual([
        { sort: [{ field: 'Timestamp' }] },
        { sort: [{ field: 'Timestamp' }] },
      ]);
    });

    it('sorts by the name of a time field renamed by a display name, as Merge drops that', () => {
      const frames = ['CPU', 'Memory'].map((name) =>
        sampledAt([1000, 2000], name, [1, 2], { displayName: 'Timestamp' })
      );

      expect(suggest(frames)?.[0].transformations?.[1].options).toEqual({ sort: [{ field: 'Time' }] });
    });

    it('offers the same templates without merging again, once a panel has the merged frame', async () => {
      const merged = await transformedData(SUMMARY, queries());

      expect(merged).toHaveLength(1);
      expect(suggest(merged)?.map(({ name, transformations }) => [name, transformations])).toEqual([
        [SUMMARY, undefined],
        [STATISTICS, undefined],
      ]);
      expect(suggest(merged)?.map(({ options }) => options?.content)).toEqual(
        suggest(queries())?.map(({ options }) => options?.content)
      );
    });

    it('says that it adds transformations, as a merged suggestion changes the data of the panel', () => {
      expect(suggest(queries())?.map(({ description }) => description)).toEqual([
        'Text - summary: adds transformations that merge the series into one table',
        'Text - statistics: adds transformations that merge the series into one table',
      ]);
    });

    it('leaves the data of a single frame alone', () => {
      expect(
        [usage(), services()].flatMap((frame) => (suggest([frame]) ?? []).map(({ transformations }) => transformations))
      ).toEqual([undefined, undefined, undefined]);
    });

    it(`lists every series of exactly ${MAX_MERGED_FRAMES} frames`, () => {
      const frames = Array.from({ length: MAX_MERGED_FRAMES }, (_, index) => timeSeries(`cpu${index}`));
      const summary = itemLines(SUMMARY, frames);

      expect(summary).toHaveLength(MAX_MERGED_FRAMES);
      expect(summary.at(-1)).toBe('- **cpu49**: ${__data.fields.cpu49:reduce:lastNotNull}');
    });

    it(`offers nothing for more than ${MAX_MERGED_FRAMES} frames, which would be slow to merge`, () => {
      const frames = Array.from({ length: MAX_MERGED_FRAMES + 1 }, (_, index) => timeSeries(`cpu${index}`));

      expect(suggest(frames)).toBeUndefined();
    });

    it(`lists the first ${MAX_TEMPLATE_FIELDS} fields of frames that have more between them`, () => {
      const frames = Array.from({ length: 2 }, (_, frame) =>
        toDataFrame({
          fields: [
            time,
            ...Array.from({ length: MAX_TEMPLATE_FIELDS }, (_, index) => ({
              name: `cpu${frame}_${index}`,
              type: FieldType.number,
              values: [1, 2, 3],
            })),
          ],
        })
      );

      expect(itemLines(SUMMARY, frames)).toHaveLength(MAX_TEMPLATE_FIELDS);
    });

    it('labels a field whose name is only whitespace as Value', () => {
      const frames = [toDataFrame({ fields: [time, { name: '   ', type: FieldType.number, values: [1, 2, 3] }] })];

      expect(itemLines(SUMMARY, frames)).toEqual(['- **Value**: ${__data.fields["   "]:reduce:lastNotNull}']);
      expect(listItems(renderSuggestion(SUMMARY, withDisplay(frames)))).toEqual(['Value: 3']);
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

  it('render an entry for each series of several frames, formatted by its own config', async () => {
    expect(listItems(await renderMerged(SUMMARY, queries()))).toEqual(['CPU: 75.0%', 'Memory: 65 B']);
    expect(tableRows(await renderMerged(STATISTICS, queries()))).toEqual([
      ['Field', 'Last', 'Min', 'Mean', 'Max'],
      ['CPU', '75.0%', '40.0%', '57.5%', '75.0%'],
      ['Memory', '65 B', '35 B', '48.3 B', '65 B'],
    ]);
  });

  it('render the newest value of a series with a timestamp that an earlier frame lacks', async () => {
    const frames = [sampledAt([1000, 3000], 'CPU', [1, 3]), sampledAt([1000, 2000, 3000], 'Memory', [10, 20, 30])];

    expect(listItems(await renderMerged(SUMMARY, frames))).toEqual(['CPU: 3', 'Memory: 30']);
    expect(tableRows(await renderMerged(STATISTICS, frames))).toEqual([
      ['Field', 'Last', 'Min', 'Mean', 'Max'],
      ['CPU', '3', '1', '2', '3'],
      ['Memory', '30', '10', '20', '30'],
    ]);
  });

  it('render the newest value of a series, whichever order its frames come in', async () => {
    const frames = [sampledAt([2000, 3000], 'CPU', [2, 3]), sampledAt([1000, 2000], 'Memory', [10, 20])];

    expect(listItems(await renderMerged(SUMMARY, frames))).toEqual(['CPU: 3', 'Memory: 20']);
  });

  it.each([
    { name: 'a time field the data source names itself', config: { displayNameFromDS: 'Timestamp' } },
    { name: 'a time field renamed by a display name', config: { displayName: 'Timestamp' } },
  ])('render the newest value of a series through $name', async ({ config }) => {
    const frames = [
      sampledAt([1000, 3000], 'CPU', [1, 3], config),
      sampledAt([1000, 2000, 3000], 'Memory', [10, 20, 30], config),
    ];

    expect(listItems(await renderMerged(SUMMARY, frames))).toEqual(['CPU: 3', 'Memory: 30']);
  });

  it('render the newest value of a series when the time field is not the first field of its frame', async () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'End', type: FieldType.time, values: [9000, 9001] },
          { name: 'CPU', type: FieldType.number, values: [1, 3] },
          { ...time, values: [1000, 3000] },
        ],
      }),
      sampledAt([1000, 2000, 3000], 'Memory', [10, 20, 30]),
    ];

    expect(suggest(frames)?.[0].transformations?.[1].options).toEqual({ sort: [{ field: 'Time' }] });
    expect(listItems(await renderMerged(SUMMARY, frames))).toEqual(['CPU: 3', 'Memory: 30']);
  });

  it('render a merged summary once per row, after a switch to Per row', async () => {
    const container = renderSuggestion(SUMMARY, queries(), await appliedData(SUMMARY, queries()), RenderMode.PerRow);

    expect(listItems(container)).toEqual([
      'CPU: 75.0%',
      'Memory: 65 B',
      'CPU: 75.0%',
      'Memory: 65 B',
      'CPU: 75.0%',
      'Memory: 65 B',
    ]);
  });

  it('render a series without any value next to a series with one', async () => {
    const frames = [sampledAt([1000, 2000], 'CPU', [1, 2]), timeSeries('Memory', [null, null, null])];

    expect(listItems(await renderMerged(SUMMARY, frames))).toEqual(['CPU: 2', 'Memory:']);
  });

  it('render a series that a later query no longer returns as empty, not as another series', async () => {
    const container = await renderMerged(SUMMARY, queries(), [queries()[1]]);

    expect(listItems(container)).toEqual(['CPU:', 'Memory: 65 B']);
  });

  it('render the series of a later query whose frames can no longer be merged, by the selected frame', async () => {
    const later = [
      queries()[0],
      toDataFrame({
        fields: [
          { ...time, name: 'time' },
          { name: 'Memory', type: FieldType.number, values: [35, 45, 65], config: { unit: 'bytes' } },
        ],
      }),
    ];
    const series = await appliedData(SUMMARY, queries(), later);

    expect(series).toHaveLength(2);
    expect(listItems(renderSuggestion(SUMMARY, queries(), [series[0]]))).toEqual(['CPU: 75.0%', 'Memory:']);
  });

  it('render a merged series as No data once the query returns no frames', async () => {
    const container = await renderMerged(SUMMARY, queries(), []);

    expect(container.textContent?.trim()).toBe('No data');
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

  it('keeps every merged series in step with new query data, without a query selector', async () => {
    const props = createProps(createReplaceVariables(), {
      data: createData(await appliedData(SUMMARY, queries())),
      options: getOptions(SUMMARY, queries()),
    });

    const { rerender } = render(<TextNGPanel {...props} />);

    expect(listItems(screen.getByTestId('TextNGPanel-converted-content'))).toEqual(['CPU: 75.0%', 'Memory: 65 B']);
    expect(screen.queryByRole('combobox', { name: 'Query' })).not.toBeInTheDocument();

    const newData = await appliedData(SUMMARY, queries(), [
      timeSeries('CPU', [40, 75, 90], { unit: 'percent', decimals: 1 }),
      timeSeries('Memory', [35, 45, 80], { unit: 'bytes' }),
    ]);
    rerender(<TextNGPanel {...props} data={createData(newData)} />);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(listItems(screen.getByTestId('TextNGPanel-converted-content'))).toEqual(['CPU: 90.0%', 'Memory: 80 B']);
    expect(screen.queryByRole('combobox', { name: 'Query' })).not.toBeInTheDocument();
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

  it('lists a merged Text suggestion after the established panels, so a new panel never defaults to it', async () => {
    const { suggestions } = await getAllSuggestions(queries());

    expect(suggestions[0].transformations).toBeUndefined();
    expect(suggestions.slice(-2).map(({ pluginId, name }) => `${pluginId}: ${name}`)).toEqual([
      `text: ${SUMMARY}`,
      `text: ${STATISTICS}`,
    ]);
  });

  it('previews the summary of several queries through its transformations, with every series', async () => {
    const { suggestions } = await getAllSuggestions(queries());
    const summary = suggestions.find(({ pluginId, name }) => pluginId === 'text' && name === SUMMARY);
    if (!summary) {
      throw new Error('no summary suggestion');
    }

    const data = { series: queries(), state: LoadingState.Done, timeRange: getDefaultTimeRange() };
    const { rerender } = render(<VisualizationSuggestionCard data={data} suggestion={summary} width={200} />);

    expect(listItems(await screen.findByTestId('TextNGPanel-converted-content'))).toEqual([
      'CPU: 75.0%',
      'Memory: 65 B',
    ]);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    rerender(
      <VisualizationSuggestionCard
        data={{
          ...data,
          series: [
            timeSeries('CPU', [40, 75, 90], { unit: 'percent', decimals: 1 }),
            timeSeries('Memory', [35, 45, 80], { unit: 'bytes' }),
          ],
        }}
        suggestion={summary}
        width={200}
      />
    );

    await waitFor(() =>
      expect(listItems(screen.getByTestId('TextNGPanel-converted-content'))).toEqual(['CPU: 90.0%', 'Memory: 80 B'])
    );
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
