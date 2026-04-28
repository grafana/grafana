import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StringArrayEditor } from './strings';

describe('StringArrayEditor', () => {
  const baseItem = { settings: {} } as Parameters<typeof StringArrayEditor>[0]['item'];
  const emptyContext = { data: [] };

  it('renders existing values', () => {
    render(<StringArrayEditor value={['one', 'two']} onChange={jest.fn()} item={baseItem} context={emptyContext} />);

    expect(screen.getByDisplayValue('one')).toBeInTheDocument();
    expect(screen.getByDisplayValue('two')).toBeInTheDocument();
  });

  it('updates an entry on blur when text is non-empty', () => {
    const onChange = jest.fn();
    render(<StringArrayEditor value={['x']} onChange={onChange} item={baseItem} context={emptyContext} />);

    const input = screen.getByDisplayValue('x');
    fireEvent.blur(input, { target: { value: 'updated' } });

    expect(onChange).toHaveBeenCalledWith(['updated']);
  });

  it('removes an entry when cleared on blur', () => {
    const onChange = jest.fn();
    render(<StringArrayEditor value={['only']} onChange={onChange} item={baseItem} context={emptyContext} />);

    const input = screen.getByDisplayValue('only');
    fireEvent.blur(input, { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('adds a new string from the add row on Enter', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<StringArrayEditor value={[]} onChange={onChange} item={baseItem} context={emptyContext} />);

    await user.click(screen.getByRole('button', { name: /add text/i }));
    const addInput = screen.getByPlaceholderText('Add text');
    await user.type(addInput, 'new{Enter}');

    expect(onChange).toHaveBeenCalledWith(['new']);
  });
});
