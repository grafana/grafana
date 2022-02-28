import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { Platform } from './Platform';

describe('Platform::', () => {
  it('shows form to connect if not connected', () => {
    const store = configureStore();
    render(
      <Provider store={store}>
        <Platform isConnected={false} />
      </Provider>
    );

    expect(screen.getByTestId('connect-form')).toBeInTheDocument();
  });

  it('shows connected message if connected', () => {
    const store = configureStore();
    render(
      <Provider store={store}>
        <Platform isConnected />
      </Provider>
    );

    expect(screen.getByTestId('connected-wrapper')).toBeInTheDocument();
  });
});
