import {
  LIST_PUBLIC_DASHBOARD_URL,
  viewPublicDashboardUrl,
  //ListPublicDashboardTable,
} from './PublicDashboardListTable';

//import { render, screen, waitFor, act } from '@testing-library/react';
//import React from 'react';

describe('listPublicDashboardsUrl', () => {
  it('has the correct url', () => {
    expect(LIST_PUBLIC_DASHBOARD_URL).toEqual('/api/dashboards/public');
  });
});

describe('viewPublicDashboardUrl', () => {
  it('has the correct url', () => {
    expect(viewPublicDashboardUrl('abcd')).toEqual('public-dashboards/abcd');
  });
});

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => ({
    get: jest.fn().mockResolvedValue([
      {
        uid: 'SdZwuCZVz',
        accessToken: 'beeaf92f6ab3467f80b2be922c7741ab',
        title: 'New dashboardasdf',
        dashboardUid: 'iF36Qb6nz',
        isEnabled: false,
      },
      {
        uid: 'EuiEbd3nz',
        accessToken: '8687b0498ccf4babb2f92810d8563b33',
        title: 'New dashboard',
        dashboardUid: 'kFlxbd37k',
        isEnabled: true,
      },
    ]),
  }),
}));

//describe('ListPublicDashboardTable', () => {
//  test('renders properly', async() => {
//    act(() => {
//      render(<ListPublicDashboardTable />)
//    });

//    //await waitFor(() => screen.getByRole('table'));
//    expect(screen.getByText("Dashboard")).toBeInTheDocument();
//    //expect(screen.getAllByRole("tr")).toHaveLength(2);
//  })
//})
