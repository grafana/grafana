import { render, screen } from '@testing-library/react';
import React from 'react';

import { locationService } from '@grafana/runtime';

import { TestProvider } from '../../../../test/helpers/TestProvider';

import { NavBar } from './NavBar';

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
  return render(
    <TestProvider>
      <NavBar />
    </TestProvider>
  );
};

describe('Render', () => {
  it('should render component', async () => {
    setup();
    const sidemenu = await screen.findByTestId('sidemenu');
    expect(sidemenu).toBeInTheDocument();
  });

  it('should not render when in kiosk mode is tv', async () => {
    setup();

    locationService.partial({ kiosk: 'tv' });
    const sidemenu = screen.queryByTestId('sidemenu');
    expect(sidemenu).not.toBeInTheDocument();
  });

  it('should not render when in kiosk mode is full', async () => {
    setup();

    locationService.partial({ kiosk: '1' });
    const sidemenu = screen.queryByTestId('sidemenu');
    expect(sidemenu).not.toBeInTheDocument();
  });
});
