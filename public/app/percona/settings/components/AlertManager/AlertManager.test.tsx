import React from 'react';
import { Provider } from 'react-redux';
import { StoreState } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import * as reducers from 'app/percona/shared/core/reducers';
import { AlertManager } from './AlertManager';

describe('AlertManager::', () => {
  it('Renders correctly with props', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { alertManagerUrl: 'fake.url', alertManagerRules: 'rule' } },
          },
        } as StoreState)}
      >
        <AlertManager />
      </Provider>
    );

    expect(screen.getByDisplayValue('fake.url')).toBeInTheDocument();
    expect(screen.getByTestId('alertmanager-rules').textContent).toBe('rule');
  });

  it('Disables apply changes on initial values', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { alertManagerUrl: 'fake.url', alertManagerRules: 'rule' } },
          },
        } as StoreState)}
      >
        <AlertManager />
      </Provider>
    );

    expect(screen.getByTestId('alertmanager-button')).toBeDisabled();
  });

  it('Calls apply changes', async () => {
    const spy = spyOn(reducers, 'updateSettingsAction').and.callThrough();
    const { container } = render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { alertManagerUrl: 'fake.url', alertManagerRules: 'rule' } },
          },
        } as StoreState)}
      >
        <AlertManager />
      </Provider>
    );

    fireEvent.change(screen.getByTestId('alertmanager-rules'), { target: { value: 'new key' } });
    fireEvent.submit(screen.getByTestId('alertmanager-button'));
    await waitForElementToBeRemoved(() => container.querySelector('.fa-spin'));

    expect(spy).toHaveBeenCalled();
  });
});
