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

const radio = (name: string) => screen.queryByRole('radio', { name });

describe('FieldColorEditor color assignment', () => {
  afterEach(() => {
    cleanup();
    setTestFlags({});
  });

  it('does not show the assignment when the feature flag is disabled', () => {
    setTestFlags({ [FlagKeys.DatavizColorByValue]: false });
    renderEditor({ mode: FieldColorModeId.PaletteClassic });

    expect(radio('Series index')).not.toBeInTheDocument();
  });

  it.each([
    { name: 'a by value scheme', mode: FieldColorModeId.ContinuousGrYlRd },
    { name: 'thresholds', mode: FieldColorModeId.Thresholds },
  ])('does not show the assignment for $name', ({ mode }) => {
    setTestFlags({ [FlagKeys.DatavizColorByValue]: true });
    renderEditor({ mode });

    expect(radio('Series index')).not.toBeInTheDocument();
  });

  it.each([
    { mode: FieldColorModeId.PaletteClassic, checked: 'Series index' },
    { mode: FieldColorModeId.PaletteClassicByName, checked: 'Series name' },
  ])('checks the default assignment of $mode', ({ mode, checked }) => {
    setTestFlags({ [FlagKeys.DatavizColorByValue]: true });
    renderEditor({ mode });

    expect(radio(checked)).toBeChecked();
  });

  it.each([
    { name: 'colors by series', settings: { byValueSupport: true, bySeriesSupport: true } },
    { name: 'has no by value support', settings: {} },
  ])('only offers series assignments when the panel $name', ({ settings }) => {
    setTestFlags({ [FlagKeys.DatavizColorByValue]: true });
    renderEditor({ mode: FieldColorModeId.PaletteClassic, assignment: 'value' }, settings);

    expect(radio('Series name')).toBeInTheDocument();
    expect(radio('Value')).not.toBeInTheDocument();
    expect(radio('Series index')).toBeChecked();
  });

  it.each([
    { mode: FieldColorModeId.PaletteCategoricalNext, assignment: 'Value', expected: 'value' },
    { mode: FieldColorModeId.PaletteCategoricalNext, assignment: 'Series name', expected: 'seriesName' },
    { mode: FieldColorModeId.PaletteClassicByName, assignment: 'Series index', expected: 'seriesIndex' },
  ])('saves the $assignment assignment for $mode', async ({ mode, assignment, expected }) => {
    setTestFlags({ [FlagKeys.DatavizColorByValue]: true });
    const onChange = renderEditor({ mode });

    await userEvent.click(radio(assignment)!);

    expect(onChange).toHaveBeenCalledWith({ mode, assignment: expected });
  });

  it("removes the assignment when the palette's default is picked", async () => {
    setTestFlags({ [FlagKeys.DatavizColorByValue]: true });
    const onChange = renderEditor({ mode: FieldColorModeId.PaletteClassic, assignment: 'value' });

    expect(radio('Value')).toBeChecked();
    await userEvent.click(radio('Series index')!);

    expect(onChange).toHaveBeenCalledWith({ mode: FieldColorModeId.PaletteClassic, assignment: undefined });
  });
});
