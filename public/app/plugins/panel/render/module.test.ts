import { PanelOptionsEditorBuilder } from '@grafana/data';

import { RenderCodeEditor } from './RenderCodeEditor';
import { RenderPanel } from './RenderPanel';
import { renderPanelChangeHandler } from './migrations';
import { plugin } from './module';
import { getDefaultRenderCode } from './templates';
import { type Options } from './types';

describe('render panel module', () => {
  it('renders RenderPanel without the panel padding and supports content-fit layouts', () => {
    expect(plugin.panel).toBe(RenderPanel);
    expect(plugin.noPadding).toBe(true);
    expect(plugin.supportsFitContent).toBe(true);
  });

  it('defaults the code option to the KPI briefing template', () => {
    expect(plugin.defaults).toEqual({ code: getDefaultRenderCode() });
  });

  it('edits the code option with the render code editor', () => {
    const builder = new PanelOptionsEditorBuilder<Options>();
    plugin.getPanelOptionsSupplier()(builder, { data: [] });

    expect(builder.getItems().map((item) => [item.path, item.editor])).toEqual([['code', RenderCodeEditor]]);
  });

  it('converts options when another panel type changes into this one', () => {
    expect(plugin.onPanelTypeChanged).toBe(renderPanelChangeHandler);
  });
});
