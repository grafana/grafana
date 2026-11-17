import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AlertActionButton } from './AlertActionButton';

describe('AlertActionButton', () => {
  it('renders a button and calls onClick when clicked', async () => {
    const onClick = jest.fn();
    render(<AlertActionButton onClick={onClick}>Request increase</AlertActionButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Request increase' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const onClick = jest.fn();
    render(
      <AlertActionButton onClick={onClick} disabled>
        Request increase
      </AlertActionButton>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Request increase' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('has a transparent background, a white border and white text', () => {
    render(<AlertActionButton>Request increase</AlertActionButton>);
    expect(screen.getByRole('button', { name: 'Request increase' })).toHaveStyle({
      background: 'transparent',
      border: '1px solid #ffffff',
      color: '#ffffff',
    });
  });
});
