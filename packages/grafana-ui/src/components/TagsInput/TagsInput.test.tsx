import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';

import { TagsInput } from './TagsInput';

describe('TagsInput', () => {
  it('removes tag when clicking on remove button', async () => {
    const onChange = jest.fn();
    render(<TagsInput onChange={onChange} tags={['One', 'Two']} />);

    fireEvent.click(await screen.findByRole('button', { name: /Remove \"One\"/i }));

    expect(onChange).toHaveBeenCalledWith(['Two']);
  });

  it('does NOT remove tag when clicking on remove button when disabled', async () => {
    const onChange = jest.fn();
    render(<TagsInput onChange={onChange} tags={['One', 'Two']} disabled />);

    fireEvent.click(await screen.findByRole('button', { name: /Remove \"One\"/i }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
