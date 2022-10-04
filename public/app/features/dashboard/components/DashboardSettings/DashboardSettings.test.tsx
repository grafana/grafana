import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { NavModel, NavModelItem } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { configureStore } from 'app/store/configureStore';

import { DashboardModel } from '../../state';

import { DashboardSettings } from './DashboardSettings';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getSearchObject: jest.fn().mockResolvedValue({}),
    partial: jest.fn(),
  },
}));

setBackendSrv({
  get: jest.fn().mockResolvedValue([]),
} as any);

describe('DashboardSettings', () => {
  it('pressing escape navigates away correctly', async () => {
    const dashboard = new DashboardModel(
      {
        title: 'Foo',
      },
      {
        folderId: 1,
      }
    );

    const store = configureStore();
    const context = getGrafanaContextMock();
    const sectionNav: NavModel = { main: { text: 'Dashboards' }, node: { text: 'Dashboards' } };
    const pageNav: NavModelItem = { text: 'My cool dashboard' };

    render(
      <GrafanaContext.Provider value={context}>
        <Provider store={store}>
          <BrowserRouter>
            <DashboardSettings editview="settings" dashboard={dashboard} sectionNav={sectionNav} pageNav={pageNav} />
          </BrowserRouter>
        </Provider>
      </GrafanaContext.Provider>
    );

    expect(await screen.findByRole('tab', { name: 'Tab Settings' })).toBeInTheDocument();
  });
});
