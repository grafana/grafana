import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

import { MultipleActions } from './MultipleActions';

describe('MultipleActions::', () => {
  it('renders correctly with actions', async () => {
    render(
      <MultipleActions
        actions={[
          {
            content: 'Test action 1',
            action: jest.fn(),
          },
          {
            content: 'Test action 2',
            action: jest.fn(),
          },
        ]}
      />
    );

    const btn = screen.getByTestId('dropdown-menu-toggle');
    await waitFor(() => fireEvent.click(btn));
    expect(screen.getAllByTestId('dropdown-button')).toHaveLength(2);
  });

  it('renders correctly disabled', () => {
    render(<MultipleActions actions={[]} disabled />);

    expect(screen.getByTestId('dropdown-menu-toggle')).toBeDisabled();
  });
});
