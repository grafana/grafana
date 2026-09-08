import { FieldConfigProperty, PanelOptionsEditorBuilder, standardEditorsRegistry, toDataFrame } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { type Options, RenderMode } from '../panelcfg.gen';

import { textNGPanelOptions } from './module';

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

function getRenderModeItem() {
  const item = getItems().find((option) => option.path === 'renderMode');
  if (!item) {
    throw new Error('renderMode option is not registered');
  }
  return item;
}

describe('textNGPanelOptions', () => {
  it('registers renderMode with a default that preserves a single render', () => {
    expect(getRenderModeItem().defaultValue).toBe(RenderMode.Once);
  });

  it('is the only option visible in the pane', () => {
    const visible = getItems().filter((option) =>
      option.showIf?.({} as Options, [toDataFrame({ fields: [{ name: 'a', values: [1] }] })])
    );

    expect(visible.map((option) => option.path)).toEqual(['renderMode']);
  });

  it.each([
    ['there is no data', undefined],
    ['no frames were returned', []],
    ['the frame has no rows', [toDataFrame({ fields: [{ name: 'a', values: [] }] })]],
  ])('hides renderMode when %s', (_name, data) => {
    expect(getRenderModeItem().showIf?.({} as Options, data)).toBe(false);
  });

  it('shows renderMode once a frame has rows', () => {
    const data = [toDataFrame({ fields: [{ name: 'a', values: [1] }] })];

    expect(getRenderModeItem().showIf?.({} as Options, data)).toBe(true);
  });

  it('hides renderMode when the text.newFeatures flag is off, even with rows', () => {
    setTestFlags({ [FlagKeys.TextNewFeatures]: false });
    const data = [toDataFrame({ fields: [{ name: 'a', values: [1] }] })];

    expect(getRenderModeItem().showIf?.({} as Options, data)).toBe(false);
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
