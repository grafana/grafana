import { fireEvent, render, screen } from '@testing-library/react';

import { PanelOptionsEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { LegendDisplayMode, type OptionsWithLegend } from '@grafana/schema';

import { addLegendOptions } from './legend';

// The builder resolves the editor component for built-in editors (boolean/radio/number)
// from the standard editors registry, which the grafana-ui package can't populate from
// public/app. Stub the ids addLegendOptions needs — the custom width editor under test is
// inline and doesn't use the registry.
const StubEditor = () => null;
standardEditorsRegistry.setInit(() =>
  ['boolean', 'radio', 'number', 'stats-picker'].map((id) => ({ id, name: id, editor: StubEditor }))
);

type LegendConfig = OptionsWithLegend['legend'];
type LegendEditorItem = ReturnType<typeof buildItems>[number];

function buildItems() {
  const builder = new PanelOptionsEditorBuilder<OptionsWithLegend>();
  addLegendOptions(builder);
  return builder.getItems();
}

function getItem(path: string) {
  const item = buildItems().find((i) => i.path === path);
  if (!item) {
    throw new Error(`no editor registered for path "${path}"`);
  }
  return item;
}

function legend(overrides: Partial<LegendConfig> = {}): LegendConfig {
  return {
    showLegend: true,
    displayMode: LegendDisplayMode.List,
    placement: 'bottom',
    calcs: [],
    ...overrides,
  };
}

function showIf(item: LegendEditorItem, l: LegendConfig) {
  // showIf is optional on the editor item; every editor under test defines one.
  return item.showIf!({ legend: l }, undefined);
}

describe('addLegendOptions', () => {
  describe('width editor', () => {
    function renderWidthEditor(initialValue: number | string | undefined = undefined) {
      const item = getItem('legend.width');
      const onChange = jest.fn();
      const Editor = item.editor;
      render(<Editor value={initialValue} onChange={onChange} item={item} context={{ data: [] }} />);
      return { onChange, input: screen.getByRole('textbox') };
    }

    // The editor's onInputCapture stops propagation of the native `input` event, which is
    // what userEvent.type relies on to reach React's onChange — so it never fires under
    // userEvent. A `change` event bypasses that capture handler, so fireEvent.change is the
    // correct tool here.
    /* eslint-disable testing-library/prefer-user-event */
    it('parses a bare numeric value into a number', () => {
      const { onChange, input } = renderWidthEditor();
      fireEvent.change(input, { target: { value: '220' } });
      expect(onChange).toHaveBeenCalledWith(220);
    });

    it('keeps a percentage value as a string', () => {
      const { onChange, input } = renderWidthEditor();
      fireEvent.change(input, { target: { value: '35%' } });
      expect(onChange).toHaveBeenCalledWith('35%');
    });

    it('keeps a value with a px suffix as a string', () => {
      const { onChange, input } = renderWidthEditor();
      fireEvent.change(input, { target: { value: '220px' } });
      expect(onChange).toHaveBeenCalledWith('220px');
    });

    it('emits undefined when the value is cleared (auto)', () => {
      const { onChange, input } = renderWidthEditor(220);
      fireEvent.change(input, { target: { value: '' } });
      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('trims surrounding whitespace before parsing', () => {
      const { onChange, input } = renderWidthEditor();
      fireEvent.change(input, { target: { value: '  220  ' } });
      expect(onChange).toHaveBeenCalledWith(220);
    });

    it('emits undefined for a whitespace-only value', () => {
      const { onChange, input } = renderWidthEditor();
      fireEvent.change(input, { target: { value: '   ' } });
      expect(onChange).toHaveBeenCalledWith(undefined);
    });
    /* eslint-enable testing-library/prefer-user-event */

    it('is shown only for a visible legend placed on the right', () => {
      const item = getItem('legend.width');
      expect(showIf(item, legend({ showLegend: true, placement: 'right' }))).toBe(true);
      expect(showIf(item, legend({ showLegend: true, placement: 'bottom' }))).toBe(false);
      expect(showIf(item, legend({ showLegend: false, placement: 'right' }))).toBe(false);
    });
  });

  describe('overflow editor', () => {
    it('defaults to ellipsis', () => {
      expect(getItem('legend.overflow').defaultValue).toBe('ellipsis');
    });

    it('offers ellipsis and wrap options', () => {
      const item = getItem('legend.overflow');
      const values = (item.settings as { options: Array<{ value: string }> }).options.map((o) => o.value);
      expect(values).toEqual(['ellipsis', 'wrap']);
    });

    it('is shown only for a visible legend in table display mode', () => {
      const item = getItem('legend.overflow');
      expect(showIf(item, legend({ showLegend: true, displayMode: LegendDisplayMode.Table }))).toBe(true);
      expect(showIf(item, legend({ showLegend: true, displayMode: LegendDisplayMode.List }))).toBe(false);
      expect(showIf(item, legend({ showLegend: false, displayMode: LegendDisplayMode.Table }))).toBe(false);
    });
  });
});
