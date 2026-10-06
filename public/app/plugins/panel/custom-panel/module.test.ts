import { PanelOptionsEditorBuilder } from '@grafana/data';

import { CustomPanel } from './CustomPanel';
import { CustomPanelCodeEditor } from './CustomPanelCodeEditor';
import { customPanelChangeHandler, customPanelMigrationHandler, needsApiVersionPin } from './migrations';
import { plugin } from './module';
import { DRAWING_API_VERSION } from './runtime/constants';
import { getDefaultDrawingCode } from './templates';
import { type Options } from './types';

describe('custom panel module', () => {
  it('renders CustomPanel without the panel padding and supports content-fit layouts', () => {
    expect(plugin.panel).toBe(CustomPanel);
    expect(plugin.noPadding).toBe(true);
    expect(plugin.supportsFitContent).toBe(true);
  });

  it('defaults new panels to the KPI briefing template and the latest drawing API version', () => {
    expect(plugin.defaults).toEqual({ code: getDefaultDrawingCode(), apiVersion: DRAWING_API_VERSION });
  });

  it('pins saved panels without a version through the migration handler', () => {
    expect(plugin.onPanelMigration).toBe(customPanelMigrationHandler);
    expect(plugin.shouldMigrate).toBe(needsApiVersionPin);
  });

  it('edits the code option with the custom panel code editor', () => {
    const builder = new PanelOptionsEditorBuilder<Options>();
    plugin.getPanelOptionsSupplier()(builder, { data: [] });

    const items = builder.getItems();
    expect(items.map((item) => item.path)).toEqual(['code', 'apiVersion']);
    expect(items[0].editor).toBe(CustomPanelCodeEditor);
    // The version is never edited in the UI.
    expect(items[1].showIf?.({ code: '' }, [])).toBe(false);
  });

  it('converts options when another panel type changes into this one', () => {
    expect(plugin.onPanelTypeChanged).toBe(customPanelChangeHandler);
  });
});
