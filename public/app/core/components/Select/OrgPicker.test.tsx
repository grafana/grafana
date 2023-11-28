import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { OrgPicker } from './OrgPicker';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: () =>
      Promise.resolve([
        { name: 'Org 1', id: 0 },
        { name: 'Org 2', id: 1 },
      ]),
  }),
}));

function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

describe('OrgPicker', () => {
  it('should render', async () => {
    render(
      <>
        <label htmlFor={'picker'}>Org picker</label>
        <OrgPicker onSelected={() => {}} inputId={'picker'} />
      </>
    );

    expect(await screen.findByRole('combobox', { name: 'Org picker' })).toBeInTheDocument();
  });

  it('should have the options', async () => {
    const { user } = setup(
      <>
        <label htmlFor={'picker'}>Org picker</label>
        <OrgPicker onSelected={() => {}} inputId={'picker'} />
      </>
    );
    await user.click(await screen.findByRole('combobox', { name: 'Org picker' }));
    expect(screen.getByText('Org 1')).toBeInTheDocument();
    expect(screen.getByText('Org 2')).toBeInTheDocument();
  });
});
