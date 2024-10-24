import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SupplementaryResultError } from './SupplementaryResultError';

describe('SupplementaryResultError', () => {
  it('shows short warning message', () => {
    const error = { data: { message: 'Test error message' } };
    const title = 'Error loading supplementary query';

    render(<SupplementaryResultError error={error} title={title} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(error.data.message)).toBeInTheDocument();
  });

  it('shows long warning message', async () => {
    // we make a long message
    const messagePart = 'One two three four five six seven eight nine ten.';
    const message = messagePart.repeat(3);
    const error = { data: { message } };
    const title = 'Error loading supplementary query';

    render(<SupplementaryResultError error={error} title={title} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    const button = screen.getByText('Show details');
    await userEvent.click(button);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('allows arbitrary components in the message', async () => {
    const error = { data: { message: 'error' } };
    render(<SupplementaryResultError error={error} message={<div data-testid="custom-stuff" />} title={'Error'} />);
    expect(screen.getByTestId('custom-stuff')).toBeInTheDocument();
  });
});
