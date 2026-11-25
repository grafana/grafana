import { PanelOptionsEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { type OptionsWithTooltip, SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { addTooltipOptions, tooltipQuickEdit } from './tooltip';

// The builder resolves built-in editors from the standard editors registry, which grafana-ui can't populate.
const StubEditor = () => null;
standardEditorsRegistry.setInit(() =>
  ['boolean', 'radio', 'number'].map((id) => ({ id, name: id, editor: StubEditor }))
);

describe('tooltipQuickEdit', () => {
  it('names only options that addTooltipOptions registers', () => {
    const builder = new PanelOptionsEditorBuilder<OptionsWithTooltip>();
    addTooltipOptions(builder);
    const ids = builder.getItems().map((item) => item.id);

    expect(tooltipQuickEdit().optionIds.filter((id) => !ids.includes(id))).toEqual([]);
  });

  it.each([
    { mode: TooltipDisplayMode.Single, text: 'Single' },
    { mode: TooltipDisplayMode.Multi, text: 'All' },
    { mode: TooltipDisplayMode.None, text: 'Hidden' },
  ])('summarizes the $mode mode as $text', ({ mode, text }) => {
    const summary = tooltipQuickEdit().summary?.({
      options: { tooltip: { mode, sort: SortOrder.None } },
      fieldConfig: { defaults: {}, overrides: [] },
    });
    expect(summary).toEqual({ text });
  });
});
