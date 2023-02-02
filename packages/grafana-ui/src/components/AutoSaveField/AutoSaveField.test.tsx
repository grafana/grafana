import { render, screen } from '@testing-library/react';
import React from 'react';

import { Input } from '../Input/Input';

import { AutoSaveField, Props } from './AutoSaveField';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    label: 'Test',
    onFinishChange: jest.fn(),
    children: <Input id="test" />,
  };

  Object.assign(props, propOverrides);

  render(<AutoSaveField {...props} />);
};

describe('AutoSaveField ', () => {
  it('renders with an Input as a children', () => {
    setup();
    expect(screen.getByLabelText('Test')).toBeInTheDocument();
  });
});
