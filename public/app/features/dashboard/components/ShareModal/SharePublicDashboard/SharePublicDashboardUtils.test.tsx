import { DataSourceRef, DataQuery, TypedVariableModel } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { updateConfig } from 'app/core/config';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import {
  PublicDashboard,
  dashboardHasTemplateVariables,
  publicDashboardPersisted,
  generatePublicDashboardUrl,
  getUnsupportedDashboardDatasources,
} from './SharePublicDashboardUtils';

const mockDS = mockDataSource({
  name: 'mock-ds',
  type: 'mock-ds-type',
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: () =>
      Promise.resolve(
        new DataSourceWithBackend({
          ...mockDS,
          meta: {
            ...mockDS.meta,
            alerting: true,
            backend: true,
          },
        })
      ),
  }),
}));

describe('dashboardHasTemplateVariables', () => {
  it('false', () => {
    let variables: TypedVariableModel[] = [];
    expect(dashboardHasTemplateVariables(variables)).toBe(false);
  });

  it('true', () => {
    //@ts-ignore
    let variables: TypedVariableModel[] = ['a'];
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
  it('itIsSupported', async () => {
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
    const unsupportedDataSources = await getUnsupportedDashboardDatasources(panelArray);
    expect(unsupportedDataSources).toEqual([]);
  });

  it('itIsNotSupported', async () => {
    const pm = {
      targets: [
        {
          datasource: { type: 'blah' } as DataSourceRef,
        } as DataQuery,
      ] as DataQuery[],
    } as PanelModel;
    const panelArray: PanelModel[] = [pm];
    const unsupportedDataSources = await getUnsupportedDashboardDatasources(panelArray);

    expect(unsupportedDataSources).toEqual(['blah']);
  });
});
