import { render, screen } from '@testing-library/react';
import React from 'react';

import BasicSettings, { Props } from './BasicSettings';

const setup = () => {
  const props: Props = {
    dataSourceName: 'Graphite',
    isDefault: false,
    onDefaultChange: jest.fn(),
    onNameChange: jest.fn(),
  };

  return render(<BasicSettings {...props} />);
};

describe('Basic Settings', () => {
  it('should render component', async () => {
    setup();

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Default')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});
