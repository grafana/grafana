import { PanelOptionsEditorBuilder, standardEditorsRegistry, VizOrientation } from '@grafana/data';
import { BarGaugeDisplayMode, BarGaugeSizing } from '@grafana/schema';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';

import { plugin } from './module';
import { type Options } from './panelcfg.gen';

standardEditorsRegistry.setInit(getAllOptionEditors);

function buildItems() {
  const builder = new PanelOptionsEditorBuilder<Options>();
  plugin.getPanelOptionsSupplier()(builder, { data: [] });
  return builder.getItems();
}

describe('bargauge module', () => {
  it('wires up all shared handlers on the plugin', () => {
    expect(plugin.onPanelTypeChanged).toBeDefined();
    expect(plugin.onPanelMigration).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((plugin as any).suggestionsSupplier).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((plugin as any).presetsSupplier).toBeDefined();
    expect(plugin.fieldConfigRegistry).toBeDefined();
  });

  it('registers the expected bar gauge options', () => {
    const paths = buildItems().map((item) => item.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        'displayMode',
        'valueMode',
        'namePlacement',
        'showUnfilled',
        'sizing',
        'minVizWidth',
        'minVizHeight',
        'maxVizHeight',
      ])
    );
  });

  it('uses defaults from panelcfg for the display mode option', () => {
    const displayMode = buildItems().find((item) => item.path === 'displayMode');
    expect(displayMode?.defaultValue).toBe(BarGaugeDisplayMode.Gradient);
  });

  it('registers two namePlacement radios gated by orientation', () => {
    const items = buildItems().filter((item) => item.path === 'namePlacement');
    expect(items).toHaveLength(2);

    const nonVertical = { orientation: VizOrientation.Horizontal } as Options;
    const vertical = { orientation: VizOrientation.Vertical } as Options;

    // Exactly one of the two radios should show for a given orientation.
    expect(items.filter((item) => item.showIf?.(nonVertical, undefined))).toHaveLength(1);
    expect(items.filter((item) => item.showIf?.(vertical, undefined))).toHaveLength(1);
  });

  it('hides "show unfilled" for the LCD display mode', () => {
    const showUnfilled = buildItems().find((item) => item.path === 'showUnfilled');
    expect(showUnfilled?.showIf?.({ displayMode: BarGaugeDisplayMode.Lcd } as Options, undefined)).toBe(false);
    expect(showUnfilled?.showIf?.({ displayMode: BarGaugeDisplayMode.Basic } as Options, undefined)).toBe(true);
  });

  it('only shows manual size sliders when sizing is manual', () => {
    const items = buildItems();
    const minVizWidth = items.find((item) => item.path === 'minVizWidth');
    const minVizHeight = items.find((item) => item.path === 'minVizHeight');
    const maxVizHeight = items.find((item) => item.path === 'maxVizHeight');

    const autoVertical = { sizing: BarGaugeSizing.Auto, orientation: VizOrientation.Vertical } as Options;
    const manualVertical = { sizing: BarGaugeSizing.Manual, orientation: VizOrientation.Vertical } as Options;
    const manualHorizontal = { sizing: BarGaugeSizing.Manual, orientation: VizOrientation.Horizontal } as Options;

    expect(minVizWidth?.showIf?.(autoVertical, undefined)).toBe(false);
    expect(minVizWidth?.showIf?.(manualVertical, undefined)).toBe(true);
    // width slider is for vertical orientation only
    expect(minVizWidth?.showIf?.(manualHorizontal, undefined)).toBe(false);

    // height sliders are for horizontal orientation only
    expect(minVizHeight?.showIf?.(manualHorizontal, undefined)).toBe(true);
    expect(maxVizHeight?.showIf?.(manualHorizontal, undefined)).toBe(true);
    expect(minVizHeight?.showIf?.(manualVertical, undefined)).toBe(false);
  });
});
