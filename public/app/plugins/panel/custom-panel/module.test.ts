import { PanelOptionsEditorBuilder } from '@grafana/data';

import { CustomPanel } from './CustomPanel';
import { CustomPanelCodeEditor } from './CustomPanelCodeEditor';
import { customPanelChangeHandler } from './migrations';
import { plugin } from './module';
import { getDefaultDrawingCode } from './templates';
import { type Options } from './types';

describe('custom panel module', () => {
  it('renders CustomPanel without the panel padding and supports content-fit layouts', () => {
    expect(plugin.panel).toBe(CustomPanel);
    expect(plugin.noPadding).toBe(true);
    expect(plugin.supportsFitContent).toBe(true);
  });

  it('defaults the code option to the KPI briefing template', () => {
    expect(plugin.defaults).toEqual({ code: getDefaultDrawingCode() });
  });

  it('edits the code option with the custom panel code editor', () => {
    const builder = new PanelOptionsEditorBuilder<Options>();
    plugin.getPanelOptionsSupplier()(builder, { data: [] });

    expect(builder.getItems().map((item) => [item.path, item.editor])).toEqual([['code', CustomPanelCodeEditor]]);
  });

  it('converts options when another panel type changes into this one', () => {
    expect(plugin.onPanelTypeChanged).toBe(customPanelChangeHandler);
  });
});
