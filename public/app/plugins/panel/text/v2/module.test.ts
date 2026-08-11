import { PanelOptionsEditorBuilder, standardEditorsRegistry, toDataFrame } from '@grafana/data';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { type Options, RenderMode } from '../panelcfg.gen';

import { textNGPanelOptions } from './module';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({ getBooleanValue: () => mockNewFeatures }),
}));

let mockNewFeatures = true;

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

const getRenderModeItem = () => getItem('renderMode');

describe('textNGPanelOptions', () => {
  beforeEach(() => {
    mockNewFeatures = true;
  });

  it('registers renderMode with a default that preserves a single render', () => {
    expect(getRenderModeItem().defaultValue).toBe(RenderMode.Once);
  });

  it('registers handlebars off by default', () => {
    expect(getItem('handlebars').defaultValue).toBe(false);
  });

  it.each([
    ['with data', [toDataFrame({ fields: [{ name: 'a', values: [1] }] })]],
    // Handlebars is still useful without data, through the variable and date helpers.
    ['without data', []],
  ])('shows only the data options in the pane %s', (_name, data) => {
    const visible = getItems().filter((option) => option.showIf?.({} as Options, data) ?? true);

    expect(visible.map((option) => option.path)).toEqual(data.length ? ['renderMode', 'handlebars'] : ['handlebars']);
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
    mockNewFeatures = false;
    const data = [toDataFrame({ fields: [{ name: 'a', values: [1] }] })];

    expect(getRenderModeItem().showIf?.({} as Options, data)).toBe(false);
  });
});
