import { type DataSourceApi, type DataSourceRef, type DataQuery } from '@grafana/data';
import { config, DataSourceWithBackend, getDataSourceInstance } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { updateConfig } from 'app/core/config';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { type PanelModel } from 'app/features/dashboard/state/PanelModel';

import {
  type PublicDashboard,
  generatePublicDashboardUrl,
  getUnsupportedDashboardDatasources,
  isEmailSharingEnabled,
} from './SharePublicDashboardUtils';

const mockDS = mockDataSource({
  name: 'mock-ds',
  type: 'mock-ds-type',
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstance: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(getDataSourceInstance).mockResolvedValue(
    new DataSourceWithBackend({
      ...mockDS,
      meta: {
        ...mockDS.meta,
        alerting: true,
        backend: true,
      },
    }) as unknown as DataSourceApi
  );
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

describe('isEmailSharingEnabled', () => {
  const originalPublicDashboardsEnabled = config.publicDashboardsEnabled;
  const originalLicenseInfo = config.licenseInfo;

  beforeEach(() => {
    config.publicDashboardsEnabled = true;
    config.licenseInfo = { ...originalLicenseInfo, enabledFeatures: { publicDashboardsEmailSharing: true } };
  });

  afterEach(() => {
    setTestFlags({});
    config.publicDashboardsEnabled = originalPublicDashboardsEnabled;
    config.licenseInfo = originalLicenseInfo;
  });

  it.each([
    { name: 'all gates are enabled', publicDashboardsEnabled: true, flag: true, licensed: true, expected: true },
    {
      name: 'public dashboards are disabled',
      publicDashboardsEnabled: false,
      flag: true,
      licensed: true,
      expected: false,
    },
    { name: 'the flag is disabled', publicDashboardsEnabled: true, flag: false, licensed: true, expected: false },
    { name: 'the license is missing', publicDashboardsEnabled: true, flag: true, licensed: false, expected: false },
  ])('returns $expected when $name', ({ publicDashboardsEnabled, flag, licensed, expected }) => {
    config.publicDashboardsEnabled = publicDashboardsEnabled;
    config.licenseInfo = { ...originalLicenseInfo, enabledFeatures: { publicDashboardsEmailSharing: licensed } };
    setTestFlags({ publicDashboardsEmailSharing: flag });

    expect(isEmailSharingEnabled()).toBe(expected);
  });

  it('defaults to disabled when the flag is not configured', () => {
    setTestFlags({});

    expect(isEmailSharingEnabled()).toBe(false);
  });

  it('evaluates the current flag value on every call', () => {
    setTestFlags({ publicDashboardsEmailSharing: false });
    expect(isEmailSharingEnabled()).toBe(false);

    setTestFlags({ publicDashboardsEmailSharing: true });
    expect(isEmailSharingEnabled()).toBe(true);

    setTestFlags({ publicDashboardsEmailSharing: false });
    expect(isEmailSharingEnabled()).toBe(false);
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
