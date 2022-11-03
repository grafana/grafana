import { render, screen } from '@testing-library/react';
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
});
