import { type PanelModel } from '@grafana/data';

import {
  convertDynamicTextOptions,
  customPanelChangeHandler,
  customPanelMigrationHandler,
  needsApiVersionPin,
} from './migrations';
import { getBlankDrawingCode } from './templates';
import { type Options } from './types';

// Runs drawing code the way the frame bootstrap does, against one frame with `host` and `cpu` fields.
function drawConverted(code: string, rows: Array<{ host: string; cpu: number }>) {
  let registered: ((ctx: unknown) => void) | undefined;
  new Function('panel', code)({ onRender: (fn: (ctx: unknown) => void) => (registered = fn) });
  const root = document.createElement('div');
  const series = rows.length
    ? [
        {
          length: rows.length,
          fields: [
            {
              name: 'host',
              type: 'string',
              values: rows.map((row) => row.host),
              config: {},
              state: { displayName: 'Host' },
            },
            {
              name: 'cpu',
              type: 'number',
              values: rows.map((row) => row.cpu),
              config: {},
              state: { displayName: 'cpu' },
            },
          ],
        },
      ]
    : [];
  registered!({ root, data: { state: 'Done', series, errors: [] } });
  return root;
}

const panelWithDefaults = (): PanelModel<Options> => ({
  id: 1,
  type: 'custom-panel',
  options: { code: 'default code' },
  fieldConfig: { defaults: {}, overrides: [] },
});

describe('convertDynamicTextOptions', () => {
  it('converts a field template rendered for every row, escaping the values', () => {
    const result = convertDynamicTextOptions({
      content: '<b>{{host}}</b>: {{ cpu }}%',
      renderMode: 'everyRow',
      styles: '.row { color: red; }',
    });

    expect(result.converted).toBe(true);
    expect(result.code).toContain(JSON.stringify('<b>{{host}}</b>: {{ cpu }}%'));

    const root = drawConverted(result.code, [
      { host: 'a<script>', cpu: 12 },
      { host: 'b', cpu: 34 },
    ]);
    expect([...root.querySelectorAll('.row')].map((row) => row.textContent)).toEqual(['a<script>: 12%', 'b: 34%']);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('style')!.textContent).toContain('.row { color: red; }');
  });

  it('fills an allRows template from the first row only and matches fields by display name', () => {
    const result = convertDynamicTextOptions({ content: '{{[Host]}} at {{cpu}}', renderMode: 'allRows' });
    const root = drawConverted(result.code, [
      { host: 'first', cpu: 1 },
      { host: 'second', cpu: 2 },
    ]);

    expect(result.converted).toBe(true);
    expect(root.querySelector('.row')).toBeNull();
    expect(root.querySelector('.dynamic-text')!.textContent).toBe('first at 1');
  });

  it('shows the default content when the query returns no rows', () => {
    const result = convertDynamicTextOptions({ content: '{{host}}', defaultContent: 'Nothing yet' });

    expect(drawConverted(result.code, []).querySelector('.dynamic-text')!.textContent).toBe('Nothing yet');
  });

  it('treats the legacy everyRow=false flag as allRows', () => {
    const result = convertDynamicTextOptions({ content: '{{host}}', everyRow: false });

    const root = drawConverted(result.code, [
      { host: 'a', cpu: 1 },
      { host: 'b', cpu: 2 },
    ]);

    expect(root.querySelector('.dynamic-text')!.textContent).toBe('a');
  });

  it.each([
    ['a block helper', { content: '{{#each data}}{{host}}{{/each}}' }],
    ['a partial', { content: '{{> header}}' }],
    ['unescaped output', { content: '{{{html}}}' }],
    ['an inline helper call', { content: '{{date time "YYYY"}}' }],
    ['custom helpers', { content: '{{host}}', helpers: 'handlebars.registerHelper("x", () => 1)' }],
    ['afterRender code', { content: '{{host}}', afterRender: 'console.log(1)' }],
    ['the data render mode', { content: '{{host}}', renderMode: 'data' }],
  ])('keeps the original content in a comment when the template uses %s', (_, options) => {
    const result = convertDynamicTextOptions(options);

    expect(result.converted).toBe(false);
    expect(result.code).toContain(` *   ${options.content}`);
    expect(result.code.endsWith(getBlankDrawingCode())).toBe(true);
    const onRender = jest.fn();
    new Function('panel', result.code)({ onRender });
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it('escapes comment terminators in the original content so the code still parses', () => {
    const content = '{{#if x}}*/ alert(1) /*{{/if}}';
    const result = convertDynamicTextOptions({ content });
    const onRender = jest.fn();

    new Function('panel', result.code)({ onRender });
    expect(result.code).toContain('{{#if x}}*\\/ alert(1) /*{{/if}}');
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it('falls back to the blank template for options without string content', () => {
    expect(convertDynamicTextOptions(undefined)).toEqual({
      code: expect.stringContaining(getBlankDrawingCode()),
      converted: false,
    });
  });
});

describe('customPanelChangeHandler', () => {
  it('converts options coming from the dynamic text panel', () => {
    const options = customPanelChangeHandler(
      panelWithDefaults(),
      'marcusolsson-dynamictext-panel',
      { content: '{{host}}' },
      {
        defaults: {},
        overrides: [],
      }
    );

    expect(options).toEqual({ code: convertDynamicTextOptions({ content: '{{host}}' }).code, apiVersion: 1 });
  });

  it('keeps the default code when coming from any other panel', () => {
    const panel = panelWithDefaults();
    const options = customPanelChangeHandler(panel, 'text', { content: '# Hello' }, { defaults: {}, overrides: [] });

    expect(options).toEqual({ code: 'default code' });
  });
});

describe('customPanelMigrationHandler', () => {
  const panel = (options: Partial<Options>): PanelModel<Partial<Options>> => ({ ...panelWithDefaults(), options });

  it('pins a saved panel without a version to version 1', () => {
    expect(needsApiVersionPin(panel({ code: 'x' }))).toBe(true);
    expect(customPanelMigrationHandler(panel({ code: 'x' }) as PanelModel<Options>)).toEqual({
      code: 'x',
      apiVersion: 1,
    });
  });

  it('keeps the version a panel was saved with, even one this Grafana does not support', () => {
    expect(needsApiVersionPin(panel({ code: 'x', apiVersion: 7 }))).toBe(false);
    expect(customPanelMigrationHandler(panel({ code: 'x', apiVersion: 7 }) as PanelModel<Options>)).toEqual({
      code: 'x',
      apiVersion: 7,
    });
  });

  it('leaves a new panel without code to the defaults', () => {
    expect(needsApiVersionPin(panel({}))).toBe(false);
  });
});
