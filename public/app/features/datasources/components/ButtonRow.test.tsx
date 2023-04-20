import { screen, render } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { ButtonRow, Props } from './ButtonRow';

const setup = (propOverrides?: object) => {
  const props: Props = {
    canSave: false,
    canDelete: false,
    onSubmit: jest.fn(),
    onDelete: jest.fn(),
    onTest: jest.fn(),
    exploreUrl: '/explore',
  };

  Object.assign(props, propOverrides);

  return render(<ButtonRow {...props} />);
};

describe('<ButtonRow>', () => {
  it('should render component', () => {
    setup();

    expect(screen.getByRole('link', { name: 'Explore' })).toBeInTheDocument();
  });
  it('should render save & test', () => {
    setup({ canSave: true });

    expect(screen.getByRole('button', { name: selectors.pages.DataSource.saveAndTest })).toBeInTheDocument();
  });
});
