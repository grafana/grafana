import { render, screen, fireEvent } from '@testing-library/react';

import { NumberValueEditor } from './number';

const baseItem = {
  settings: {},
} as Parameters<typeof NumberValueEditor>[0]['item'];

describe('NumberValueEditor', () => {
  it('floors values when integer setting is enabled', () => {
    const onChange = jest.fn();
    render(
      <NumberValueEditor
        value={2}
        onChange={onChange}
        item={{ settings: { integer: true } } as typeof baseItem}
        context={{ data: [] }}
        id="n1"
      />
    );

    const input = screen.getByTestId('input-wrapper').firstChild?.firstChild as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '3.7' } });

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('passes through fractional values when integer is not set', () => {
    const onChange = jest.fn();
    render(
      <NumberValueEditor
        value={1}
        onChange={onChange}
        item={baseItem}
        context={{ data: [] }}
        id="n2"
      />
    );

    const input = screen.getByTestId('input-wrapper').firstChild?.firstChild as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '3.25' } });

    expect(onChange).toHaveBeenCalledWith(3.25);
  });
});
