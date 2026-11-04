import { PanelOptionsEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { type OptionsWithTooltip } from '@grafana/schema';

import { addTooltipOptions } from './tooltip';

// The builder resolves built-in editors from the standard editors registry, which the
// grafana-ui package can't populate from public/app.
const StubEditor = () => null;
standardEditorsRegistry.setInit(() =>
  ['boolean', 'radio', 'number'].map((id) => ({ id, name: id, editor: StubEditor }))
);

function getItem(path: string) {
  const builder = new PanelOptionsEditorBuilder<OptionsWithTooltip>();
  addTooltipOptions(builder);
  const item = builder.getItems().find((i) => i.path === path);
  if (!item) {
    throw new Error(`no editor registered for path "${path}"`);
  }
  return item;
}

describe('addTooltipOptions', () => {
  it.each(['tooltip.maxWidth', 'tooltip.maxHeight'])('describes the expected unit for %s', (path) => {
    expect(getItem(path).description).toMatch(/in pixels/);
  });
});
