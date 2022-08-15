import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { PlatformService } from '../Platform.service';

import { Connected } from './Connected';
import { Messages } from './Connected.messages';

jest.mock('app/percona/settings/components/Platform/Platform.service');
jest.mock('app/percona/settings/Settings.service');

describe('Connected:', () => {
  it('render connected message', () => {
    render(
      <Provider store={configureStore()}>
        <Connected />
      </Provider>
    );

    const wrapper = screen.getByTestId('connected-wrapper');

    expect(wrapper).toBeInTheDocument();
    expect(wrapper.textContent?.includes(Messages.connected)).toBeTruthy();
  });

  it('should render disconnect modal for platform users', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: true },
            settings: { result: { isConnectedToPortal: true } },
          },
        } as StoreState)}
      >
        <Connected />
      </Provider>
    );

    fireEvent.click(screen.getByTestId('disconnect-button'));
    expect(screen.getByText(Messages.modalTitle)).toBeInTheDocument();
  });

  it('should disconnect when confirming in modal', async () => {
    jest.useFakeTimers();
    const disconnectSpy = jest.spyOn(PlatformService, 'disconnect').mockResolvedValueOnce();
    const locationSpy = jest.fn();
    const location = {
      ...window.location,
      assign: locationSpy,
    };

    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: location,
    });

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: true },
            settings: { result: { isConnectedToPortal: true } },
          },
        } as StoreState)}
      >
        <Connected />
      </Provider>
    );

    fireEvent.click(screen.getByTestId('disconnect-button'));
    await waitFor(() => screen.getByText(Messages.modalTitle));

    const confirmButton = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-label') === 'Confirm Modal Danger Button');

    fireEvent.click(confirmButton!);
    await Promise.resolve();

    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('should render force-disconnect modal for non platform users', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { isConnectedToPortal: true } },
          },
        } as StoreState)}
      >
        <Connected />
      </Provider>
    );

    fireEvent.click(screen.getByTestId('disconnect-button'));
    expect(screen.getByTestId('force-disconnect-modal')).toBeInTheDocument();
  });

  it('should force disconnect for non percona platform users', async () => {
    const forceDisconnectSpy = jest.spyOn(PlatformService, 'forceDisconnect').mockResolvedValueOnce();

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { isConnectedToPortal: true } },
          },
        } as StoreState)}
      >
        <Connected />
      </Provider>
    );

    fireEvent.click(screen.getByTestId('disconnect-button'));
    await waitFor(() => screen.getByTestId('force-disconnect-modal'));

    const confirmButton = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-label') === 'Confirm Modal Danger Button');

    fireEvent.click(confirmButton!);

    await waitFor(() => expect(forceDisconnectSpy).toHaveBeenCalled());
  });
});
