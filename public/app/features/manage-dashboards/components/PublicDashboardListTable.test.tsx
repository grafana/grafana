//import { locationService } from '@grafana/runtime';
import {
  //listPublicDashboardsUrl,
  //viewPublicDashboardUrl,
  getPublicDashboards,
} from './PublicDashboardListTable';

//describe('listPublicDashboardsUrl', () => {
//it('has the correct url', () => {
//expect(listPublicDashboardsUrl()).toEqual('/api/dashboards/public');
//});
//});

//describe('viewPublicDashboardUrl', () => {
//it('has the correct url', () => {
//expect(viewPublicDashboardUrl("abcd")).toEqual('public-dashboards/abcd');
//});
//});

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

describe('getPublicDashboards', () => {
  //locationService.push('/dashboard/public');

  test('returns public dashboards', async () => {
    const results = await getPublicDashboards();
    expect(results).Equal([
      {
        uid: 'EuiEbd3nz',
        accessToken: '8687b0498ccf4babb2f92810d8563b33',
        title: 'New dashboard',
        dashboardUid: 'kFlxbd37k',
        isEnabled: true,
      },
      {
        uid: 'SdZwuCZVz',
        accessToken: 'beeaf92f6ab3467f80b2be922c7741ab',
        title: 'New dashboardasdf',
        dashboardUid: 'iF36Qb6nz',
        isEnabled: false,
      },
    ]);
  });
});
