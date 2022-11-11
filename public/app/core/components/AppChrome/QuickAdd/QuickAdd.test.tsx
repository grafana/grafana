import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { QuickAdd } from './QuickAdd';

describe('QuickAdd', () => {
  it('renders a `New` button', () => {
    render(<QuickAdd />);
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('renders the `New` text on a larger viewport', () => {
    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      matches: () => false,
    }));
    render(<QuickAdd />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('does not render the text on a smaller viewport', () => {
    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      matches: () => true,
    }));
    render(<QuickAdd />);
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });

  it('shows options when clicked', async () => {
    render(<QuickAdd />);
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alert rule' })).toBeInTheDocument();
  });
});
