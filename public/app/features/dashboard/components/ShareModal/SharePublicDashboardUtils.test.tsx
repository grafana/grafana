import { VariableModel } from 'app/features/variables/types';

import {
  PublicDashboard,
  dashboardHasTemplateVariables,
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
  it('has the right uid', () => {
    let pubdash = { uid: 'abcd1234' } as PublicDashboard;
    expect(generatePublicDashboardUrl(pubdash)).toEqual('/public-dashboards/abcd1234');
  });
});
