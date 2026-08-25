import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ColorValueEditor } from './color';

describe('ColorValueEditor', () => {
  it('shows placeholder text when value is empty and details are enabled', () => {
    render(<ColorValueEditor value={undefined} onChange={jest.fn()} details />);

    expect(screen.getByText('Select color')).toBeVisible();
  });

  it('shows custom placeholder from settings when value is empty', () => {
    render(<ColorValueEditor value={undefined} onChange={jest.fn()} details settings={{ placeholder: 'Pick one' }} />);

    expect(screen.getByText('Pick one')).toBeVisible();
  });

  it('shows current color name when value is set', () => {
    render(<ColorValueEditor value="#ff0000" onChange={jest.fn()} details />);

    expect(screen.getByText('#ff0000')).toBeVisible();
  });

  it('renders clear control when clearable and value is present', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<ColorValueEditor value="red" onChange={onChange} details settings={{ isClearable: true }} />);

    await user.click(screen.getByRole('button', { name: /clear settings/i }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('exposes the color name as a button so keyboard users can open the picker', () => {
    render(<ColorValueEditor value="#ff0000" onChange={jest.fn()} details />);

    expect(screen.getByRole('button', { name: '#ff0000' })).toHaveAttribute('type', 'button');
  });

  it('exposes the placeholder as a button when no color is set', () => {
    render(<ColorValueEditor value={undefined} onChange={jest.fn()} details />);

    expect(screen.getByRole('button', { name: 'Select color' })).toHaveAttribute('type', 'button');
  });

  it('opens the color picker from the keyboard via the color name', async () => {
    const user = userEvent.setup();
    render(<ColorValueEditor value="#ff0000" onChange={jest.fn()} details />);

    screen.getByRole('button', { name: '#ff0000' }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });
});
