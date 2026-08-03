import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PinningPrototypeControls } from './PinningPrototypeControls';

describe('PinningPrototypeControls', () => {
  it('selects a pinning interaction', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<PinningPrototypeControls value="menu" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Divider' }));

    expect(onChange).toHaveBeenCalledWith('divider');
  });
});
