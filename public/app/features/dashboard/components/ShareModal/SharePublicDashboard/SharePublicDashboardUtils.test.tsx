import { DataSourceRef, DataQuery } from '@grafana/data/src/types/query';
import { updateConfig } from 'app/core/config';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { VariableModel } from 'app/features/variables/types';

import {
  PublicDashboard,
  dashboardHasTemplateVariables,
  publicDashboardPersisted,
  generatePublicDashboardUrl,
  getUnsupportedDashboardDatasources,
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

    expect(generatePublicDashboardUrl(pubdash.accessToken!)).toEqual(`${appUrl}public-dashboards/${accessToken}`);
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

describe('getUnsupportedDashboardDatasources', () => {
  it('itIsSupported', () => {
    const pm = {
      targets: [
        {
          datasource: { type: 'prometheus' } as DataSourceRef,
        } as DataQuery,
        {
          datasource: { type: '__expr__' } as DataSourceRef,
        } as DataQuery,
        {
          datasource: { type: 'datasource' } as DataSourceRef,
        } as DataQuery,
      ] as DataQuery[],
    } as PanelModel;
    const panelArray: PanelModel[] = [pm];
    expect(getUnsupportedDashboardDatasources(panelArray)).toEqual([]);
  });

  it('itIsNotSupported', () => {
    const pm = {
      targets: [
        {
          datasource: { type: 'blah' } as DataSourceRef,
        } as DataQuery,
      ] as DataQuery[],
    } as PanelModel;
    const panelArray: PanelModel[] = [pm];
    expect(getUnsupportedDashboardDatasources(panelArray)).toEqual(['blah']);
  });
});
