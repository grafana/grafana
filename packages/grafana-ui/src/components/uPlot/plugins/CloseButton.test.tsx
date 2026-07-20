import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CloseButton } from './CloseButton';

describe('CloseButton (uPlot)', () => {
  it('renders a close control with the default accessible name', () => {
    render(<CloseButton onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
  });

  it('uses a custom aria-label when provided', () => {
    render(<CloseButton aria-label="Dismiss tooltip" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Dismiss tooltip' })).toBeVisible();
  });

  it('invokes onClick when activated with pointer', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<CloseButton onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('invokes onClick when activated with keyboard', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<CloseButton onClick={onClick} />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards style to the button element', () => {
    render(<CloseButton onClick={() => {}} style={{ zIndex: 12 }} />);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveStyle({ zIndex: '12' });
  });
});
