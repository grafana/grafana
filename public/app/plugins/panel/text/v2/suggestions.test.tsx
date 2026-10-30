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
import { MAX_SUMMARY_FIELDS, textSuggestionsSupplier } from './suggestions';
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

function withDisplay(frames: DataFrame[]): DataFrame[] {
  return applyFieldOverrides({
    data: frames,
    fieldConfig: { defaults: {}, overrides: [] },
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

function summaryLines(frames: DataFrame[]) {
  return (getOptions(SUMMARY, frames).content ?? '').split('\n').filter((line) => line.startsWith('- '));
}

function renderTemplate(name: string, frames: DataFrame[], series = frames, renderMode = RenderMode.Once) {
  return renderContent(
    {
      content: getOptions(name, frames).content ?? '',
      mode: TextMode.Markdown,
      series,
      renderMode,
      format: 'html',
    },
    createReplaceVariables(),
    false
  );
}

function renderSuggestion(name: string, frames: DataFrame[], series = frames, renderMode = RenderMode.Once) {
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
        name: 'a frame without numeric fields',
        frames: [toDataFrame({ fields: [time, { name: 'host', type: FieldType.string, values: ['a', 'b', 'c'] }] })],
      },
      {
        name: `more than ${MAX_SUMMARY_FIELDS} numeric fields`,
        frames: [
          toDataFrame({
            fields: [
              time,
              ...Array.from({ length: MAX_SUMMARY_FIELDS + 1 }, (_, index) => ({
                name: `cpu${index}`,
                type: FieldType.number,
                values: [1, 2, 3],
              })),
            ],
          }),
        ],
      },
      {
        name: 'rows without a time field',
        frames: [toDataFrame({ fields: [{ name: 'CPU', type: FieldType.number, values: [40, 75, 60] }] })],
      },
      {
        name: 'a time series with a string field',
        frames: [
          toDataFrame({
            fields: [
              time,
              { name: 'host', type: FieldType.string, values: ['a', 'b', 'a'] },
              { name: 'CPU', type: FieldType.number, values: [40, 75, 60] },
            ],
          }),
        ],
      },
      {
        name: 'numeric fields without a value',
        frames: [toDataFrame({ fields: [time, { name: 'CPU', type: FieldType.number, values: [null, NaN, null] }] })],
      },
    ])('offers nothing for $name', ({ frames }) => {
      expect(suggest(frames)).toBeUndefined();
    });

    it('offers a summary and a statistics table for a time series', () => {
      expect(suggest([usage()])?.map(({ name }) => name)).toEqual([SUMMARY, STATISTICS]);
    });

    it(`offers both templates for exactly ${MAX_SUMMARY_FIELDS} numeric fields`, () => {
      const frame = toDataFrame({
        fields: [
          time,
          ...Array.from({ length: MAX_SUMMARY_FIELDS }, (_, index) => ({
            name: `cpu${index}`,
            type: FieldType.number,
            values: [1, 2, 3],
          })),
        ],
      });

      expect(suggest([frame])?.map(({ name }) => name)).toEqual([SUMMARY, STATISTICS]);
    });

    it('offers only the summary for a single row, where every statistic is the same value', () => {
      expect(suggest([aggregate()])?.map(({ name }) => name)).toEqual([SUMMARY]);
    });

    it('offers nothing when the text.newFeatures flag is off', () => {
      setTestFlags({ [FlagKeys.GrafanaNewTextPanel]: true, [FlagKeys.TextNewFeatures]: false });

      expect(suggest([usage()])).toBeUndefined();
    });
  });

  describe('generated panel', () => {
    it('renders the content once, as markdown', () => {
      expect(suggest([usage()])?.map(({ options }) => [options?.mode, options?.renderMode])).toEqual([
        [TextMode.Markdown, RenderMode.Once],
        [TextMode.Markdown, RenderMode.Once],
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
    ])('binds $name by a path the macro can read', ({ field, content }) => {
      const frames = [toDataFrame({ fields: [time, { name: field, type: FieldType.number, values: [1, 2, 3] }] })];

      expect(summaryLines(frames)).toEqual([content]);
      expect(listItems(renderSuggestion(SUMMARY, withDisplay(frames)))).toEqual([`${field}: 3`]);
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

      expect(summaryLines(frames)).toEqual([
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
      'latency: 120 ms',
      'requests: 42',
    ]);
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
});
