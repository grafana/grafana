import { VariableModel } from 'app/features/variables/types';

import {
  PublicDashboard,
  dashboardHasTemplateVariables,
  publicDashboardPersisted,
  generatePublicDashboardUrl,
  listPublicDashboardsUrl,
  getPublicDashboardConfigUrl,
  savePublicDashboardConfigUrl,
} from './SharePublicDashboardUtils';

describe('dashboardHasTemplateVariables', () => {
  it('false', () => {
    let variables: VariableModel[] = [];
    expect(dashboardHasTemplateVariables(variables)).toBe(false);
  });

  it('true', () => {
    //@ts-ignore
    let variables: VariableModel[] = ['a'];
    expect(dashboardHasTemplateVariables(variables)).toBe(true);
  });
});

describe('publicDashboardPersisted', () => {
  it('true', () => {
    let pubdash = { uid: 'abcd1234' } as PublicDashboard;
    expect(publicDashboardPersisted(pubdash)).toBe(true);
  });

  it('false', () => {
    let pubdash = { uid: '' } as PublicDashboard;
    expect(publicDashboardPersisted(pubdash)).toBe(false);
    pubdash = {} as PublicDashboard;
    expect(publicDashboardPersisted(pubdash)).toBe(false);
  });
});

describe('generatePublicDashboardUrl', () => {
  it('has the right url', () => {
    expect(generatePublicDashboardUrl('myaccesstoken')).toEqual(
      `${window.location.origin}/public-dashboards/myaccesstoken`
    );
  });
});

describe('listPublicDashboardsUrl', () => {
  it('has the correct url', () => {
    expect(listPublicDashboardsUrl()).toEqual('/api/dashboards/public');
  });
});

describe('getPublicDashboardConfigUrl', () => {
  it('builds the correct url', () => {
    expect(getPublicDashboardConfigUrl('abc1234')).toEqual('/api/dashboards/uid/abc1234/public-config');
  });
});

describe('savePublicDashboardConfigUrl', () => {
  it('builds the correct url', () => {
    expect(savePublicDashboardConfigUrl('abc1234')).toEqual('/api/dashboards/uid/abc1234/public-config');
  });
});
