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
});
