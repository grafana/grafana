import { screen, render } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { ButtonRow, Props } from './ButtonRow';

const setup = (propOverrides?: object) => {
  const props: Props = {
    canSave: false,
    onSubmit: jest.fn(),
    onTest: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return render(<ButtonRow {...props} />);
};

describe('<ButtonRow>', () => {
  it('should render component', () => {
    setup();

    expect(screen.getByText('Test')).toBeInTheDocument();
  });
  it('should render save & test', () => {
    setup({ canSave: true });

    expect(screen.getByRole('button', { name: selectors.pages.DataSource.saveAndTest })).toBeInTheDocument();
  });
});
