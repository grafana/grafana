import { VariableModel } from 'app/features/variables/types';

import {
  PublicDashboard,
  dashboardHasTemplateVariables,
  generatePublicDashboardUrl,
  publicDashboardPersisted,
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

describe('generatePublicDashboardUrl', () => {
  it('has the right uid', () => {
    let pubdash = { accessToken: 'abcd1234' } as PublicDashboard;
    expect(generatePublicDashboardUrl(pubdash)).toEqual(`${window.location.origin}/public-dashboards/abcd1234`);
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
