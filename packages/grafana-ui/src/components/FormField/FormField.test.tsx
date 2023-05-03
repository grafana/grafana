import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { FormField, Props } from './FormField';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    label: 'Test',
    labelWidth: 11,
    value: 10,
    onChange: jest.fn(),
  };

  Object.assign(props, propOverrides);

  render(<FormField {...props} />);
};

describe('FormField', () => {
  it('should render a default inputEl', () => {
    setup();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render a custom inputEl instead if specified', () => {
    setup({
      inputEl: <input type="checkbox" />,
    });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('tooltips should be focusable via Tab key', async () => {
    const tooltip = 'Test tooltip';
    setup();
    setup({
      tooltip,
    });

    //focus the first input
    screen.getAllByRole('textbox')[0].focus();
    await userEvent.tab();

    await waitFor(() => {
      screen.getByText(tooltip);
    });
  });
});
