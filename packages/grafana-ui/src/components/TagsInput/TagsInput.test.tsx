import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TagsInput } from './TagsInput';

describe('TagsInput', () => {
  it('removes tag when clicking on remove button', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<TagsInput onChange={onChange} tags={['One', 'Two']} />);

    await user.click(await screen.findByRole('button', { name: /Remove tag: One/i }));

    expect(onChange).toHaveBeenCalledWith(['Two']);
  });

  it('does NOT remove tag when clicking on remove button when disabled', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<TagsInput onChange={onChange} tags={['One', 'Two']} disabled />);

    await user.click(await screen.findByRole('button', { name: /Remove tag: One/i }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
