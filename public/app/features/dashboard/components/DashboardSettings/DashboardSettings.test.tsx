import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import { locationService, setBackendSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { DashboardModel } from '../../state';

import { DashboardSettings } from './DashboardSettings';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    partial: jest.fn(),
  },
}));

setBackendSrv({
  get: jest.fn().mockResolvedValue([]),
} as any);

describe('DashboardSettings', () => {
  it('pressing escape navigates away correctly', async () => {
    jest.spyOn(locationService, 'partial');
    const dashboard = new DashboardModel(
      {
        title: 'Foo',
      },
      {
        folderId: 1,
      }
    );
    const store = configureStore();
    render(
      <Provider store={store}>
        <BrowserRouter>
          <DashboardSettings editview="settings" dashboard={dashboard} />
        </BrowserRouter>
      </Provider>
    );

    expect(
      screen.getByText(
        (_, el) => el?.tagName.toLowerCase() === 'h1' && /Foo\s*\/\s*Settings/.test(el?.textContent ?? '')
      )
    ).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(locationService.partial).toHaveBeenCalledWith({ editview: null });
  });
});
