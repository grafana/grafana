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

  it('caps typed input at the default max length of 50 characters', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<TagsInput onChange={onChange} tags={[]} />);

    await user.type(screen.getByRole('textbox'), 'a'.repeat(51));
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(['a'.repeat(50)]);
  });

  it('adds a tag longer than 50 characters when a larger maxLength is provided', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const longTag = 'a'.repeat(80);
    render(<TagsInput onChange={onChange} tags={[]} maxLength={100} />);

    await user.type(screen.getByRole('textbox'), longTag);
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith([longTag]);
  });
});
