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

  it('uses the color name as a label for the swatch, not a second button', () => {
    render(<ColorValueEditor value="#ff0000" onChange={jest.fn()} details />);

    const swatch = screen.getByRole('button', { name: 'Pick a color' });
    const colorName = screen.getByText('#ff0000');

    expect(colorName.tagName).toBe('LABEL');
    expect(colorName).toHaveAttribute('for', swatch.getAttribute('id'));
    expect(screen.getAllByRole('button', { name: 'Pick a color' })).toHaveLength(1);
  });

  it('uses the placeholder as a label for the swatch when no color is set', () => {
    render(<ColorValueEditor value={undefined} onChange={jest.fn()} details />);

    const swatch = screen.getByRole('button', { name: 'Pick a color' });
    const placeholder = screen.getByText('Select color');

    expect(placeholder.tagName).toBe('LABEL');
    expect(placeholder).toHaveAttribute('for', swatch.getAttribute('id'));
  });

  it('opens the color picker when the color name label is clicked', async () => {
    const user = userEvent.setup();
    render(<ColorValueEditor value="#ff0000" onChange={jest.fn()} details />);

    await user.click(screen.getByText('#ff0000'));

    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('keeps the color name in a span next to the swatch so plugin-e2e toHaveColor can find it', () => {
    render(<ColorValueEditor value="#ff5733" onChange={jest.fn()} details />);

    const swatch = screen.getByRole('button', { name: 'Pick a color' });
    const colorName = screen.getByText('#ff5733');
    const span = colorName.closest('span');

    expect(span).not.toBeNull();
    expect(span).toHaveTextContent('#ff5733');
    expect(span?.previousElementSibling?.contains(swatch)).toBe(true);
  });
});
