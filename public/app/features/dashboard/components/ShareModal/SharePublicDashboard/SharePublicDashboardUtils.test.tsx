import { updateConfig } from 'app/core/config';
import { VariableModel } from 'app/features/variables/types';

import {
  PublicDashboard,
  dashboardHasTemplateVariables,
  publicDashboardPersisted,
  generatePublicDashboardUrl,
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
  it('uses the grafana config appUrl to generate the url', () => {
    const appUrl = 'http://localhost/';
    const accessToken = 'abcd1234';
    updateConfig({ appUrl });
    let pubdash = { accessToken } as PublicDashboard;

    expect(generatePublicDashboardUrl(pubdash)).toEqual(`${appUrl}public-dashboards/${accessToken}`);
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
