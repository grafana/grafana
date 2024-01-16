import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { SelectableValue } from '@grafana/data';

import { ButtonSelect } from './ButtonSelect';

const OPTIONS: SelectableValue[] = [
  {
    label: 'Hello',
    value: 'a',
  },
  {
    label: 'World',
    value: 'b',
  },
];

describe('ButtonSelect', () => {
  it('initially renders the selected value with the menu closed', () => {
    const selected = OPTIONS[0];
    render(<ButtonSelect value={selected} options={OPTIONS} onChange={() => {}} />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
  });

  it('opens the menu when clicking the button', async () => {
    const selected = OPTIONS[0];
    render(<ButtonSelect value={selected} options={OPTIONS} onChange={() => {}} />);

    const button = screen.getByText('Hello');
    await userEvent.click(button);

    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(2);
  });

  it('closes the menu when clicking an option', async () => {
    const selected = OPTIONS[0];
    const onChange = jest.fn();
    render(<ButtonSelect value={selected} options={OPTIONS} onChange={onChange} />);

    const button = screen.getByText('Hello');
    await userEvent.click(button);

    const option = screen.getByText('World');
    await userEvent.click(option);

    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(onChange).toHaveBeenCalledWith({
      label: 'World',
      value: 'b',
    });
  });
});
