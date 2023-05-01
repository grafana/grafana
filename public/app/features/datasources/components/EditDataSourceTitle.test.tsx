import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { EditDataSourceTitle } from './EditDataSourceTitle';

const setup = () => {
  const props = {
    title: 'My Datasource',
    readOnly: false,
    onNameChange: jest.fn(),
  };

  return render(<EditDataSourceTitle {...props} />);
};

describe('<EditDataSourceTitle>', () => {
  it('should render component', () => {
    setup();
    const editButton = screen.queryByTestId(selectors.pages.DataSource.nameEditIcon);
    const nameInput = screen.queryByTestId(selectors.pages.DataSource.name);
    expect(editButton).toBeInTheDocument();
    expect(nameInput).not.toBeInTheDocument();
  });

  it('should render nameInput by clicking edit icon button', async () => {
    setup();
    const editButton = screen.getByTestId(selectors.pages.DataSource.nameEditIcon);
    await userEvent.click(editButton);

    const nameInput = await screen.findByTestId(selectors.pages.DataSource.name);
    expect(nameInput).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.pages.DataSource.nameEditIcon)).not.toBeInTheDocument();
  });
});
