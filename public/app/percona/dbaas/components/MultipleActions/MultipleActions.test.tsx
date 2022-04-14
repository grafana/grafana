import React from 'react';
import { MultipleActions } from './MultipleActions';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

describe('MultipleActions::', () => {
  it('renders correctly with actions', async () => {
    const { container } = render(
      <MultipleActions
        actions={[
          {
            title: 'Test action 1',
            action: jest.fn(),
          },
          {
            title: 'Test action 2',
            action: jest.fn(),
          },
        ]}
      />
    );

    const btn = screen.getByTestId('dropdown-menu-toggle');
    await waitFor(() => fireEvent.click(btn));

    expect(container.querySelectorAll('span')).toHaveLength(2);
  });
  it('renders correctly disabled', () => {
    render(<MultipleActions actions={[]} disabled />);

    expect(screen.getByTestId('dropdown-menu-toggle')).toBeDisabled();
  });
});
