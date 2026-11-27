import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InlineButton } from './InlineButton';

describe('InlineButton', () => {
  it('renders a non-submitting button that activates from the keyboard', async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();

    render(<InlineButton onClick={onClick}>Show details</InlineButton>);

    const button = screen.getByRole('button', { name: 'Show details' });
    expect(button).toHaveAttribute('type', 'button');

    await user.tab();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('prevents interaction when disabled', async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();

    render(
      <InlineButton disabled onClick={onClick}>
        Show details
      </InlineButton>
    );

    const button = screen.getByRole('button', { name: 'Show details' });
    expect(button).toBeDisabled();

    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });
});
