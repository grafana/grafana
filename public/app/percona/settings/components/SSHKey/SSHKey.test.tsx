import React from 'react';
import { Provider } from 'react-redux';
import { StoreState } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { render, screen, fireEvent, waitForElementToBeRemoved, waitFor } from '@testing-library/react';
import * as reducers from 'app/percona/shared/core/reducers';
import { SSHKey } from './SSHKey';

describe('SSHKey::', () => {
  it('Renders correctly', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { sshKey: 'fake_key' } },
          },
        } as StoreState)}
      >
        <SSHKey />
      </Provider>
    );

    expect(screen.getByText('fake_key')).toBeInTheDocument();
  });

  it('Disables apply changes on initial values', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { sshKey: 'fake_key' } },
          },
        } as StoreState)}
      >
        <SSHKey />
      </Provider>
    );

    expect(screen.getByTestId('ssh-key-button')).toBeDisabled();
  });

  it('Calls apply changes', async () => {
    const spy = spyOn(reducers, 'updateSettingsAction').and.callThrough();
    const { container } = render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { sshKey: 'fake_key' } },
          },
        } as StoreState)}
      >
        <SSHKey />
      </Provider>
    );

    fireEvent.change(screen.getByTestId('ssh-key'), { target: { value: 'new key' } });
    await waitFor(() => expect(screen.getByTestId('ssh-key-button')).not.toBeDisabled());
    fireEvent.submit(screen.getByTestId('ssh-key-button'));

    await waitForElementToBeRemoved(() => container.querySelector('.fa-spin'));

    expect(spy).toHaveBeenCalled();
  });
});
