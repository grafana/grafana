import { render, screen, fireEvent, waitForElementToBeRemoved, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

import * as reducers from 'app/percona/shared/core/reducers';
import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { SSHKey } from './SSHKey';

jest.mock('app/percona/settings/Settings.service');

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
        {wrapWithGrafanaContextMock(<SSHKey />)}
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
        {wrapWithGrafanaContextMock(<SSHKey />)}
      </Provider>
    );

    expect(screen.getByTestId('ssh-key-button')).toBeDisabled();
  });

  it('Calls apply changes', async () => {
    const spy = jest.spyOn(reducers, 'updateSettingsAction');
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { sshKey: 'fake_key' } },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(<SSHKey />)}
      </Provider>
    );

    fireEvent.change(screen.getByTestId('ssh-key'), { target: { value: 'new key' } });
    await waitFor(() => expect(screen.getByTestId('ssh-key-button')).not.toBeDisabled());
    fireEvent.submit(screen.getByTestId('ssh-key-button'));

    await waitForElementToBeRemoved(() => screen.getByTestId('Spinner'));

    expect(spy).toHaveBeenCalled();
  });
});
