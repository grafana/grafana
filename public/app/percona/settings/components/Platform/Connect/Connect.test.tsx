import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { Connect } from './Connect';

jest.mock('../Platform.service.ts');

describe('Connect::', () => {
  it('renders Connect form correctly', () => {
    render(
      <Provider store={configureStore()}>
        <Router history={locationService.getHistory()}>
          <Connect
            onConnect={() => {}}
            connecting={false}
            initialValues={{ pmmServerId: '', pmmServerName: 'test', accessToken: '' }}
          />
        </Router>
      </Provider>
    );

    expect(screen.getByTestId('pmmServerName-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('connect-button')).toBeInTheDocument();
  });
});
