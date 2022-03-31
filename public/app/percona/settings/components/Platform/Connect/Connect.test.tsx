import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { Connect } from './Connect';

jest.mock('../Platform.service.ts');

describe('Connect::', () => {
  it('renders Connect form correctly', () => {
    render(
      <Provider store={configureStore()}>
        <Connect />
      </Provider>
    );

    expect(screen.getByTestId('pmmServerName-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('connect-button')).toBeInTheDocument();
  });
});
