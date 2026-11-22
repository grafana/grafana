import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type FieldColor, type FieldColorConfigSettings, FieldColorModeId } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { FieldColorEditor } from './fieldColor';

type Item = Parameters<typeof FieldColorEditor>[0]['item'];

function renderEditor(value: FieldColor, settings: FieldColorConfigSettings = { byValueSupport: true }) {
  const onChange = jest.fn();
  const item = { settings } as Item;
  render(<FieldColorEditor value={value} onChange={onChange} item={item} id="color" context={{ data: [] }} />);
  return onChange;
}

describe('FieldColorEditor color by value', () => {
  afterEach(() => {
    cleanup();
    setTestFlags({});
  });

  it('does not show the switch when the feature flag is disabled', () => {
    setTestFlags({ [FlagKeys.DatavizColorByValue]: false });
    renderEditor({ mode: FieldColorModeId.PaletteClassic });

    expect(screen.queryByRole('switch', { name: /Color by value/ })).not.toBeInTheDocument();
  });

  it.each([
    { name: 'a by value scheme', value: { mode: FieldColorModeId.ContinuousGrYlRd }, settings: undefined },
    { name: 'the by series name palette', value: { mode: FieldColorModeId.PaletteClassicByName }, settings: undefined },
    {
      name: 'a panel that colors by series',
      value: { mode: FieldColorModeId.PaletteClassic },
      settings: { byValueSupport: true, bySeriesSupport: true },
    },
    { name: 'a panel without by value support', value: { mode: FieldColorModeId.PaletteClassic }, settings: {} },
  ])('does not show the switch for $name', ({ value, settings }) => {
    setTestFlags({ [FlagKeys.DatavizColorByValue]: true });
    renderEditor(value, settings);

    expect(screen.queryByRole('switch', { name: /Color by value/ })).not.toBeInTheDocument();
  });

  it('enables coloring by value for a categorical palette', async () => {
    setTestFlags({ [FlagKeys.DatavizColorByValue]: true });
    const onChange = renderEditor({ mode: FieldColorModeId.PaletteCategoricalNext });

    await userEvent.click(screen.getByRole('switch', { name: /Color by value/ }));

    expect(onChange).toHaveBeenCalledWith({ mode: FieldColorModeId.PaletteCategoricalNext, byValue: true });
  });

  it('removes byValue when the switch is turned off', async () => {
    setTestFlags({ [FlagKeys.DatavizColorByValue]: true });
    const onChange = renderEditor({ mode: FieldColorModeId.PaletteClassic, byValue: true });

    expect(screen.getByRole('switch', { name: /Color by value/ })).toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: /Color by value/ }));

    expect(onChange).toHaveBeenCalledWith({ mode: FieldColorModeId.PaletteClassic, byValue: undefined });
  });
});
