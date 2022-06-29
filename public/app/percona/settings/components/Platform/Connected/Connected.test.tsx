import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { PlatformService } from '../Platform.service';

import { Connected } from './Connected';
import { Messages } from './Connected.messages';

describe('Connected::', () => {
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
      <Provider store={configureStore()}>
        <Connected />
      </Provider>
    );

    fireEvent.click(screen.getByTestId('disconnect-button'));
    await waitFor(() => screen.getByText('Disconnect PMM from Percona Platform'));

    const confirmButton = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-label') === 'Confirm Modal Danger Button');

    fireEvent.click(confirmButton!);
    await Promise.resolve();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
