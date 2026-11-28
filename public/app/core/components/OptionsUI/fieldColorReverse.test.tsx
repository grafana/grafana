import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type FieldColor, FieldColorModeId } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { FieldColorEditor } from './fieldColor';

const item = { settings: { byValueSupport: true } } as Parameters<typeof FieldColorEditor>[0]['item'];

function renderEditor(value: FieldColor, onChange = jest.fn()) {
  render(<FieldColorEditor value={value} onChange={onChange} item={item} id="color" context={{ data: [] }} />);
  return onChange;
}

describe('FieldColorEditor reverse colors', () => {
  afterEach(() => {
    cleanup();
    setTestFlags({});
  });

  it('does not show the switch when the feature flag is disabled', () => {
    setTestFlags({ [FlagKeys.DatavizReverseColorScheme]: false });
    renderEditor({ mode: FieldColorModeId.ContinuousGrYlRd });

    expect(screen.getByText('Green-Yellow-Red (by value)')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('does not show the switch for modes that cannot be reversed', () => {
    setTestFlags({ [FlagKeys.DatavizReverseColorScheme]: true });
    renderEditor({ mode: FieldColorModeId.PaletteClassic });

    expect(screen.getByText('Classic palette')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('enables reverse for a by value color scheme', async () => {
    setTestFlags({ [FlagKeys.DatavizReverseColorScheme]: true });
    const onChange = renderEditor({ mode: FieldColorModeId.ContinuousGrYlRd });

    await userEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith({ mode: FieldColorModeId.ContinuousGrYlRd, reverse: true });
  });

  it('removes reverse when the switch is turned off', async () => {
    setTestFlags({ [FlagKeys.DatavizReverseColorScheme]: true });
    const onChange = renderEditor({ mode: FieldColorModeId.ContinuousGrYlRd, reverse: true });

    expect(screen.getByRole('switch')).toBeChecked();
    await userEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith({ mode: FieldColorModeId.ContinuousGrYlRd, reverse: undefined });
  });
});
