import { act, render, screen } from '@testing-library/react';
import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import {
  applyFieldOverrides,
  type ConfigOverrideRule,
  createTheme,
  type DataFrame,
  FieldMatcherID,
  FieldType,
  getPanelDataSummary,
  type InterpolateFunction,
  type PanelPluginMeta,
  PluginType,
  type PreferredVisualisationType,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  toDataFrame,
} from '@grafana/data';
import { FlagKeys, setPanelPluginMetas } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
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
  availability: Array<number | null> = [99.9, 97.5, 100]
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

function colors(
  names: Array<string | null> = ['alpha', 'bravo', 'charlie'],
  colorNames: Array<string | null> = ['red', 'orange', 'yellow'],
  values: Array<number | null> = [2, 9, 6]
): DataFrame {
  return toDataFrame({
    fields: [
      { name: 'name', type: FieldType.string, values: names },
      { name: 'color', type: FieldType.string, values: colorNames },
      { name: 'value', type: FieldType.number, values },
    ],
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

function numberFields(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `cpu${index}`,
    type: FieldType.number,
    values: [1, 2, 3],
  }));
}

function withDisplay(frames: DataFrame[], defaults = {}, overrides: ConfigOverrideRule[] = []): DataFrame[] {
  return applyFieldOverrides({
    data: frames,
    fieldConfig: { defaults, overrides },
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

function listBody(frames: DataFrame[]) {
  return (getOptions(LIST, frames).content ?? '').split('\n').slice(3, -1);
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
      { name: 'multiple compatible frames', frames: queries() },
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
      {
        name: 'a time series without a value yet',
        frames: [toDataFrame({ fields: [time, { name: 'CPU', type: FieldType.number, values: [null, NaN, null] }] })],
      },
      {
        name: 'numeric samples without a value',
        frames: [toDataFrame({ fields: [{ name: 'Queue depth', type: FieldType.number, values: [null, null] }] })],
      },
      {
        name: 'a single row without a value',
        frames: [
          toDataFrame({
            fields: [
              { name: 'region', type: FieldType.string, values: [''] },
              { name: 'latency', type: FieldType.number, values: [null] },
            ],
          }),
        ],
      },
      { name: 'a table whose cells are all empty', frames: [services([null, '', null], [null, null, null])] },
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

    it('leaves fields whose last value is missing or empty out of the summary and the statistics', () => {
      const frames = [
        toDataFrame({
          fields: [
            time,
            { name: 'Host', type: FieldType.string, values: ['web-01', 'web-02', ''] },
            { name: 'CPU', type: FieldType.number, values: [40, 75, null] },
            { name: 'Memory', type: FieldType.number, values: [null, null, null] },
            { name: 'Disk', type: FieldType.number, values: [NaN, null, NaN] },
          ],
        }),
      ];

      expect(itemLines(SUMMARY, frames)).toEqual(['- **CPU**: ${__data.fields.CPU:reduce:lastNotNull}']);
      expect(getOptions(STATISTICS, frames).content?.split('\n').slice(5, -1)).toEqual([
        '| CPU | ${__data.fields.CPU:reduce:lastNotNull} | ${__data.fields.CPU:reduce:min} | ${__data.fields.CPU:reduce:mean} | ${__data.fields.CPU:reduce:max} |',
      ]);
    });

    it('leaves the empty cells of a single row out of its summary', () => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'region', type: FieldType.string, values: [null] },
            { name: 'latency', type: FieldType.number, values: [120] },
            { name: 'requests', type: FieldType.number, values: [NaN] },
          ],
        }),
      ];

      expect(itemLines(SUMMARY, frames)).toEqual(['- **latency**: ${__data.fields.latency:reduce:lastNotNull}']);
    });

    it('binds the list to each row, labelled by its first string field, leaving out what a row has no value for', () => {
      expect(getOptions(LIST, [services()]).content).toBe(
        [
          '{{#if (eq data.length 0)}}',
          'No data',
          '{{else}}',
          '{{#unless (eq fmt.Availability "")}}',
          '- {{#unless (eq fmt.Service "")}}<strong>${__data.fields.Service}</strong>: {{/unless}}<span>${__data.fields.Availability}</span>',
          '{{else unless (eq fmt.Service "")}}',
          '- <strong>${__data.fields.Service}</strong>',
          '{{/unless}}',
          '{{/if}}',
        ].join('\n')
      );
    });

    it.each([
      {
        name: 'a single string field',
        fields: [{ name: 'host', type: FieldType.string, values: ['a', 'b'] }],
        body: ['{{#unless (eq fmt.host "")}}', '- <span>${__data.fields.host}</span>', '{{/unless}}'],
      },
      {
        name: 'a label after a number',
        fields: [
          { name: 'requests', type: FieldType.number, values: [1, 2] },
          { name: 'host', type: FieldType.string, values: ['a', 'b'] },
        ],
        body: [
          '{{#unless (eq fmt.requests "")}}',
          '- {{#unless (eq fmt.host "")}}<strong>${__data.fields.host}</strong>: {{/unless}}<span>${__data.fields.requests}</span>',
          '{{else unless (eq fmt.host "")}}',
          '- <strong>${__data.fields.host}</strong>',
          '{{/unless}}',
        ],
      },
      {
        name: 'a series of an instant query, without its timestamp',
        fields: [
          { ...time, values: [3000, 3000] },
          { name: 'instance', type: FieldType.string, values: ['web-1', 'web-2'] },
          { name: 'Value', type: FieldType.number, values: [1, 0] },
        ],
        body: [
          '{{#unless (eq fmt.Value "")}}',
          '- {{#unless (eq fmt.instance "")}}<strong>${__data.fields.instance}</strong>: {{/unless}}<span>${__data.fields.Value}</span>',
          '{{else unless (eq fmt.instance "")}}',
          '- <strong>${__data.fields.instance}</strong>',
          '{{/unless}}',
        ],
      },
      {
        name: 'several values, each named',
        fields: [
          { name: 'host', type: FieldType.string, values: ['a', 'b'] },
          { name: 'region', type: FieldType.string, values: ['eu', 'us'] },
          { name: 'p95 *latency*', type: FieldType.number, values: [120, 80] },
        ],
        body: [
          '{{#unless (and (eq fmt.region "") (eq fmt.[p95 *latency*] ""))}}',
          '- {{#unless (eq fmt.host "")}}<strong>${__data.fields.host}</strong>: {{/unless}}<span>' +
            '{{#unless (eq fmt.region "")}}region ${__data.fields.region}{{/unless}}' +
            '{{#unless (eq fmt.[p95 *latency*] "")}}{{#unless (eq fmt.region "")}}, {{/unless}}p95 \\*latency\\* ${__data.fields["p95 *latency*"]}{{/unless}}' +
            '</span>',
          '{{else unless (eq fmt.host "")}}',
          '- <strong>${__data.fields.host}</strong>',
          '{{/unless}}',
        ],
      },
    ])('lists $name per row', ({ fields, body }) => {
      expect(listBody([toDataFrame({ fields })])).toEqual(body);
    });

    it.each([
      { name: 'a reserved word', field: 'true', condition: '(eq fmt.[true] "")' },
      { name: 'a number', field: '404', condition: '(eq fmt.[404] "")' },
      { name: 'braces and quotes', field: 'say "{{hi}}"', condition: '(eq fmt.[say "{{hi}}"] "")' },
      { name: 'a dot', field: 'cpu.usage', condition: '(eq fmt.[cpu.usage] "")' },
      { name: 'square brackets', field: 'Size [MB]', condition: '(eq fmt.[Size [MB\\]] "")' },
    ])('checks a row value displayed as $name by a path Handlebars reads literally', ({ field, condition }) => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'Service', type: FieldType.string, values: ['API', 'Web'] },
            { name: field, type: FieldType.number, values: [1, null] },
          ],
        }),
      ];

      expect(listBody(frames)[0]).toBe(`{{#unless ${condition}}}`);
      expect(listItems(renderSuggestion(LIST, withDisplay(frames)))).toEqual(['API: 1', 'Web']);
    });

    it.each([
      { name: 'a backslash', field: 'a\\b', path: '[0]' },
      { name: 'an angle bracket', field: '<b>', path: '[0]' },
    ])('keeps a label displayed with $name in every row, as the template cannot check it', ({ field, path }) => {
      const frames = [
        toDataFrame({
          fields: [
            { name: field, type: FieldType.string, values: ['API', null] },
            { name: 'Availability', type: FieldType.number, values: [99.9, 100] },
          ],
        }),
      ];

      expect(listBody(frames)).toEqual([
        '{{#unless (eq fmt.Availability "")}}',
        `- <strong>\${__data.fields${path}}</strong>: <span>\${__data.fields.Availability}</span>`,
        '{{else}}',
        `- <strong>\${__data.fields${path}}</strong>`,
        '{{/unless}}',
      ]);
      expect(listItems(renderSuggestion(LIST, withDisplay(frames)))).toEqual(['API: 99.9', ': 100']);
    });

    it('checks no field once one is displayed as fmt, which would shadow the formatted values', () => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'Service', type: FieldType.string, values: ['API', 'Web'] },
            { name: 'fmt', type: FieldType.string, values: ['a', 'b'] },
            { name: 'Availability', type: FieldType.number, values: [99.9, 100] },
          ],
        }),
      ];

      expect(listBody(frames)).toEqual([
        '- <strong>${__data.fields.Service}</strong>: <span>fmt ${__data.fields.fmt}, Availability ${__data.fields.Availability}</span>',
      ]);
    });

    it('checks no field whose display name another field shares, as a row keeps only one of them', () => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'Service', type: FieldType.string, values: ['API', 'Web'] },
            { name: 'a', type: FieldType.number, values: [1, 2], config: { displayName: 'Latency' } },
            { name: 'b', type: FieldType.number, values: [3, 4], config: { displayName: 'Latency' } },
          ],
        }),
      ];

      expect(listBody(frames)).toEqual([
        '- {{#unless (eq fmt.Service "")}}<strong>${__data.fields.Service}</strong>: {{/unless}}<span>Latency ${__data.fields.a}, Latency ${__data.fields.b}</span>',
      ]);
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
      { name: 'a plain name', field: 'service', path: '.service', key: 'fmt.service' },
      {
        name: 'a name with spaces',
        field: 'Affected service',
        path: '["Affected service"]',
        key: 'fmt.[Affected service]',
      },
      { name: 'a name with a colon', field: 'job:service', path: '[0]', key: 'fmt.[job:service]' },
      { name: 'a name with a caret', field: 'service^2', path: '[0]', key: 'fmt.[service^2]' },
      { name: 'a name with a closing brace', field: 'service}', path: '[0]', key: 'fmt.[service}]' },
    ])('binds $name by a path the row macro can read', ({ field, path, key }) => {
      const frames = [
        toDataFrame({
          fields: [
            { name: field, type: FieldType.string, values: ['API', 'Web', null] },
            { name: 'Availability', type: FieldType.number, values: [99.9, 100, 97.5] },
          ],
        }),
      ];

      expect(listBody(frames)[1]).toBe(
        `- {{#unless (eq ${key} "")}}<strong>\${__data.fields${path}}</strong>: {{/unless}}<span>\${__data.fields.Availability}</span>`
      );
      expect(listItems(renderSuggestion(LIST, withDisplay(frames)))).toEqual(['API: 99.9', 'Web: 100', '97.5']);
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

    it('leaves the data of a single frame alone', () => {
      expect(
        [usage(), services()].flatMap((frame) => (suggest([frame]) ?? []).map(({ transformations }) => transformations))
      ).toEqual([undefined, undefined, undefined]);
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

  it('render the statistics of numeric samples that have no time field', () => {
    const frames = withDisplay([
      toDataFrame({ fields: [{ name: 'Queue depth', type: FieldType.number, values: [12, 18, 7] }] }),
    ]);

    expect(tableRows(renderSuggestion(STATISTICS, frames))[1]).toEqual(['Queue depth', '7', '7', '12.3', '18']);
  });

  it('render a summary field that has since lost its values as the No value of its field config', () => {
    const series = withDisplay(
      [toDataFrame({ fields: [time, { name: 'CPU', type: FieldType.number, values: [null, null, null] }] })],
      { noValue: 'No reading' }
    );

    expect(listItems(renderSuggestion(SUMMARY, [timeSeries('CPU')], series))).toEqual(['CPU: No reading']);
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
    expect(listItems(renderSuggestion(LIST, withDisplay([services(['API', null, ''])])))).toEqual([
      'API: 99.9%',
      '97.5%',
      '100%',
    ]);
  });

  it('render a list row without a value as its label alone, and leave out a row with neither', () => {
    const container = renderSuggestion(LIST, withDisplay([services(['API', 'Worker', null], [99.9, null, null])]));

    expect(listItems(container)).toEqual(['API: 99.9%', 'Worker']);
  });

  it('render each list row with only the named values it has, as one list', () => {
    const container = renderSuggestion(
      LIST,
      withDisplay([
        colors(
          ['alpha', 'bravo', null, 'delta', null, ''],
          ['red', null, 'orange', null, null, ''],
          [2, 9, 6, null, 4, null]
        ),
      ])
    );

    expect(listItems(container)).toEqual([
      'alpha: color red, value 2',
      'bravo: value 9',
      'color orange, value 6',
      'delta',
      'value 4',
    ]);
    expect(container.querySelectorAll('ul')).toHaveLength(1);
  });

  it('render a separator only between the values a row has, whichever of them are missing', () => {
    const frames = withDisplay([
      toDataFrame({
        fields: [
          {
            name: 'host',
            type: FieldType.string,
            values: ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', null, null, null, null, null, null, null, null],
          },
          {
            name: 'a',
            type: FieldType.number,
            values: [1, 1, 1, 1, null, null, null, null, 1, 1, 1, 1, null, null, null, null],
          },
          {
            name: 'b',
            type: FieldType.number,
            values: [2, 2, null, null, 2, 2, null, null, 2, 2, null, null, 2, 2, null, null],
          },
          {
            name: 'c',
            type: FieldType.number,
            values: [3, null, 3, null, 3, null, 3, null, 3, null, 3, null, 3, null, 3, null],
          },
        ],
      }),
    ]);

    expect(listItems(renderSuggestion(LIST, frames))).toEqual([
      'h0: a 1, b 2, c 3',
      'h1: a 1, b 2',
      'h2: a 1, c 3',
      'h3: a 1',
      'h4: b 2, c 3',
      'h5: b 2',
      'h6: c 3',
      'h7',
      'a 1, b 2, c 3',
      'a 1, b 2',
      'a 1, c 3',
      'a 1',
      'b 2, c 3',
      'b 2',
      'c 3',
    ]);
  });

  it(`render a separator between the last two values of a row with ${MAX_TEMPLATE_FIELDS} fields`, () => {
    const frames = withDisplay([
      toDataFrame({
        fields: [
          { name: 'host', type: FieldType.string, values: [null, 'web-1'] },
          ...Array.from({ length: MAX_TEMPLATE_FIELDS - 1 }, (_, index) => ({
            name: `v${index}`,
            type: FieldType.number,
            values: index < MAX_TEMPLATE_FIELDS - 3 ? [null, null] : [index, null],
          })),
        ],
      }),
    ]);

    expect(listItems(renderSuggestion(LIST, frames))).toEqual(['v47 47, v48 48', 'web-1']);
  });

  it('render a list of fields named with square brackets with only the values each row has', () => {
    const frames = withDisplay([
      toDataFrame({
        fields: [
          { name: 'Disk [name]', type: FieldType.string, values: ['sda', null, 'sdc'] },
          { name: 'Size [MB]', type: FieldType.number, values: [512, 256, null] },
          { name: 'Used [%]', type: FieldType.number, values: [null, 40, 90] },
        ],
      }),
    ]);

    expect(listItems(renderSuggestion(LIST, frames))).toEqual([
      'sda: Size [MB] 512',
      'Size [MB] 256, Used [%] 40',
      'sdc: Used [%] 90',
    ]);
  });

  it('render a zero as a value, not as a missing one', () => {
    expect(listItems(renderSuggestion(LIST, withDisplay([services(['API', 'Web'], [0, null])])))).toEqual([
      'API: 0%',
      'Web',
    ]);
  });

  it('render a missing value as the No value of its field config when one is set', () => {
    const frames = withDisplay([colors(['alpha', 'bravo'], ['red', null], [2, 9])], { noValue: 'none' });

    expect(listItems(renderSuggestion(LIST, frames))).toEqual([
      'alpha: color red, value 2',
      'bravo: color none, value 9',
    ]);
  });

  it('keep every value of a list whose fields were renamed after it was suggested', () => {
    const frames = [colors(['alpha', 'bravo'], ['red', null], [2, 9])];
    const renamed = withDisplay(frames, {}, [
      {
        matcher: { id: FieldMatcherID.byName, options: 'color' },
        properties: [{ id: 'displayName', value: 'Colour' }],
      },
    ]);

    expect(listItems(renderSuggestion(LIST, withDisplay(frames), renamed))).toEqual([
      'alpha: color red, value 2',
      'bravo: color , value 9',
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

  it('leaves out the values each row is missing as the rows change', () => {
    const props = createProps(createReplaceVariables(), {
      data: createData(withDisplay([colors()])),
      options: getOptions(LIST, [colors()]),
    });

    const { rerender } = render(<TextNGPanel {...props} />);

    expect(listItems(screen.getByTestId('TextNGPanel-converted-content'))).toEqual([
      'alpha: color red, value 2',
      'bravo: color orange, value 9',
      'charlie: color yellow, value 6',
    ]);

    rerender(
      <TextNGPanel
        {...props}
        data={createData(withDisplay([colors(['alpha', 'bravo', null], ['red', null, 'yellow'], [2, 9, 6])]))}
      />
    );
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(listItems(screen.getByTestId('TextNGPanel-converted-content'))).toEqual([
      'alpha: color red, value 2',
      'bravo: value 9',
      'color yellow, value 6',
    ]);
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
});
