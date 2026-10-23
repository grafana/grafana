import { FieldConfigProperty, PanelOptionsEditorBuilder, standardEditorsRegistry, toDataFrame } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { type Options, RenderMode } from '../panelcfg.gen';

import { textNGPanelOptions } from './module';
import { MAX_RENDERED_ROWS } from './renderContent';

beforeEach(() => {
  setTestFlags({ [FlagKeys.TextNewFeatures]: true });
});

afterAll(() => {
  setTestFlags({});
});

// addSelect resolves its editor from the registry, which app.ts normally seeds.
standardEditorsRegistry.setInit(getAllOptionEditors);

function getItems() {
  const builder = new PanelOptionsEditorBuilder<Options>();
  textNGPanelOptions(builder, { data: [] });
  return builder.getItems();
}

function getItem(path: string) {
  const item = getItems().find((option) => option.path === path);
  if (!item) {
    throw new Error(`${path} option is not registered`);
  }
  return item;
}

/** The options pane shows only these; everything else is edited in the panel itself. */
const paneOptions = ['renderMode', 'pageSize'];

/** Page size only applies to a per-row render, so it takes the mode that shows it. */
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const perRow = { renderMode: RenderMode.PerRow } as Options;

describe('textNGPanelOptions', () => {
  it('registers renderMode with a default that preserves a single render', () => {
    expect(getItem('renderMode').defaultValue).toBe(RenderMode.Once);
  });

  it('leaves pageSize unset, so the page is fitted to the panel height', () => {
    expect(getItem('pageSize').defaultValue).toBeUndefined();
    expect(getItem('pageSize').settings).toMatchObject({ placeholder: 'auto' });
  });

  it('bounds the pageSize input by the hard ceiling on a single render', () => {
    expect(getItem('pageSize').settings).toMatchObject({ min: 1, max: MAX_RENDERED_ROWS, integer: true });
  });

  it('says in the pageSize description what an empty field falls back to', () => {
    expect(getItem('pageSize').description).toMatch(/based on the panel height/i);
  });

  it('hides pageSize for a once render, which has no rows to page through', () => {
    const data = [toDataFrame({ fields: [{ name: 'a', values: [1] }] })];

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    expect(getItem('pageSize').showIf?.({ renderMode: RenderMode.Once } as Options, data)).toBe(false);
  });

  it('are the only options visible in the pane', () => {
    const visible = getItems().filter((option) =>
      option.showIf?.(perRow, [toDataFrame({ fields: [{ name: 'a', values: [1] }] })])
    );

    expect(visible.map((option) => option.path)).toEqual(paneOptions);
  });

  describe.each(paneOptions)('%s', (path) => {
    it.each([
      ['there is no data', undefined],
      ['no frames were returned', []],
      ['the frame has no rows', [toDataFrame({ fields: [{ name: 'a', values: [] }] })]],
    ])('is hidden when %s', (_name, data) => {
      expect(getItem(path).showIf?.(perRow, data)).toBe(false);
    });

    it('is shown once a frame has rows', () => {
      const data = [toDataFrame({ fields: [{ name: 'a', values: [1] }] })];

      expect(getItem(path).showIf?.(perRow, data)).toBe(true);
    });

    it('is hidden when the text.newFeatures flag is off, even with rows', () => {
      setTestFlags({ [FlagKeys.TextNewFeatures]: false });
      const data = [toDataFrame({ fields: [{ name: 'a', values: [1] }] })];

      expect(getItem(path).showIf?.(perRow, data)).toBe(false);
    });
  });
});

describe('field config', () => {
  async function getFieldConfigIds(newFeatures: boolean) {
    let ids: string[] = [];
    await jest.isolateModulesAsync(async () => {
      const { setTestFlags } = await import('@grafana/test-utils/unstable');
      setTestFlags({ [FlagKeys.TextNewFeatures]: newFeatures });

      const { standardFieldConfigEditorRegistry } = await import('@grafana/data');
      standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

      const { plugin } = await import('./module');
      ids = plugin.fieldConfigRegistry.list().map((item) => item.id);
    });
    return ids;
  }

  it('registers value mappings and thresholds as the only field config options', async () => {
    expect(await getFieldConfigIds(true)).toEqual([FieldConfigProperty.Mappings, FieldConfigProperty.Thresholds]);
  });

  it('registers no field config at all when the text.newFeatures flag is off', async () => {
    expect(await getFieldConfigIds(false)).toEqual([]);
  });
});
