import React from 'react';
import { AddClusterButton } from './AddClusterButton';
import { render, screen, fireEvent } from '@testing-library/react';

describe('AddClusterButton::', () => {
  it('renders correctly and calls action', () => {
    const action = jest.fn();
    render(<AddClusterButton label="test" action={action} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    expect(screen.getByRole('button')).toHaveTextContent('test');
    expect(action).toHaveBeenCalled();
  });

  it('disables button correctly', () => {
    const action = jest.fn();
    render(<AddClusterButton label="test" action={action} disabled />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
