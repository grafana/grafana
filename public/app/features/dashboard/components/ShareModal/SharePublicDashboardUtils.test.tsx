import { DashboardModel } from 'app/features/dashboard/state';

import { dashboardCanBePublic } from './SharePublicDashboardUtils';

describe('dashboardCanBePublic', () => {
  it('can be public with no template variables', () => {
    //@ts-ignore
    const dashboard: DashboardModel = { templating: { list: [] } };
    expect(dashboardCanBePublic(dashboard)).toBe(true);
  });

  it('cannot be public with template variables', () => {
    //@ts-ignore
    const dashboard: DashboardModel = { templating: { list: [{}] } };
    expect(dashboardCanBePublic(dashboard)).toBe(false);
  });
});
