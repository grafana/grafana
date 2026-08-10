import { PanelOptionsEditorBuilder, standardEditorsRegistry, toDataFrame } from '@grafana/data';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { type Options, RenderMode } from '../panelcfg.gen';

import { textNGPanelOptions } from './module';

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
    expect(getRenderModeItem().defaultValue).toBe(RenderMode.AllRows);
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
});
