import { render, screen } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

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
  it('should render component', () => {
    setup();

    expect(screen.getByRole('textbox', { name: selectors.pages.DataSource.name })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Default' })).toBeInTheDocument();
  });
});
