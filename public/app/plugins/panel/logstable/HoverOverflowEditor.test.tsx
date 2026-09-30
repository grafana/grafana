import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HoverOverflowEditor } from './HoverOverflowEditor';

describe('HoverOverflowEditor', () => {
  it('shows an undefined value as disabled without changing the option', async () => {
    const onChange = jest.fn();

    render(
      <HoverOverflowEditor
        id="hover-overflow"
        value={undefined}
        onChange={onChange}
        item={{ id: 'hoverOverflow', name: 'Cell hover overflow' }}
        context={{ data: [] }}
      />
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
