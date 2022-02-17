import React from 'react';
import { render, screen } from '@testing-library/react';
import { AddToDashboardButton } from '.';
import userEvent from '@testing-library/user-event';

describe('Add to Dashboard', () => {
  it('Opens modal when clicked', () => {
    render(<AddToDashboardButton queries={[]} visualization="table" />);

    userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

    // waiting on https://github.com/grafana/grafana/pull/45472 to properly test this:
    // expect(screen.getByRole('dialog')).toBeInTheDocument();
    // expect(screen.getByLabelText('Add query to dashboard')).toBeInTheDocument();
    expect(screen.getByText('Add query to dashboard')).toBeInTheDocument();
  });
});
