import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';

import { FilterPill } from './FilterPill';

const onClick = jest.fn();

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

describe('FilterPill', () => {
  it('should call onClick when clicked', async () => {
    const { user } = setup(<FilterPill label="Test" selected={false} onClick={onClick} />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not show icon when not selected', () => {
    render(<FilterPill label="Test" selected={false} onClick={onClick} />);

    const icon = screen.queryByTestId('filter-pill-icon');
    expect(icon).not.toBeInTheDocument();
  });

  it('should show icon when selected', () => {
    render(<FilterPill label="Test" selected={true} onClick={onClick} />);

    const icon = screen.getByTestId('filter-pill-icon');
    expect(icon).toBeInTheDocument();
  });

  it('should set aria-pressed based on selected prop', async () => {
    const { rerender } = setup(<FilterPill label="Test" selected={false} onClick={onClick} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    rerender(<FilterPill label="Test" selected={true} onClick={onClick} />);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});
