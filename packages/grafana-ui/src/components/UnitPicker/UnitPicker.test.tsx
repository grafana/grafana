import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { UnitPicker } from './UnitPicker';

describe('UnitPicker', () => {
  it('exposes the UnitPicker container data-testid', () => {
    render(<UnitPicker onChange={() => {}} />);
    expect(screen.getByTestId(selectors.components.UnitPicker.container)).toBeInTheDocument();
  });

  it('exposes the combobox state', () => {
    render(<UnitPicker onChange={() => {}} />);
    const input = screen.getByRole('combobox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('exposes options with accessible tree roles', async () => {
    render(<UnitPicker onChange={() => {}} />);

    await userEvent.click(screen.getByRole('combobox'));
    const group = await screen.findByRole('treeitem', { name: 'Misc' });

    await userEvent.click(group);
    expect(await screen.findByRole('treeitem', { name: 'Pixels' })).toBeInTheDocument();
  });
});
