import React from 'react';
import { NavBar } from './NavBar';
import { render, screen } from '@testing-library/react';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    sidemenu: true,
    user: {},
    isSignedIn: false,
    isGrafanaAdmin: false,
    isEditor: false,
    hasEditPermissionFolders: false,
  },
}));

const setup = () => {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <NavBar />
      </Router>
    </Provider>
  );
};

describe('Render', () => {
  it('should render component', async () => {
    setup();
    const sidemenu = await screen.findByTestId('sidemenu');
    expect(sidemenu).toBeInTheDocument();
  });

  it('should not render when in kiosk mode', async () => {
    setup();

    locationService.partial({ kiosk: 'full' });
    const sidemenu = screen.queryByTestId('sidemenu');
    expect(sidemenu).not.toBeInTheDocument();
  });
});
