import { resolvePluginIdFromStack } from '@grafana/data';
import { reportLegacyDashboardApiUsage } from '@grafana/runtime';

import { type DashboardModel } from '../state/DashboardModel';

import { DashboardSrv } from './DashboardSrv';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportLegacyDashboardApiUsage: jest.fn(),
}));
jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  resolvePluginIdFromStack: jest.fn(),
}));

const reportMock = reportLegacyDashboardApiUsage as jest.Mock;
const resolveMock = resolvePluginIdFromStack as jest.Mock;

describe('DashboardSrv.getCurrent legacy telemetry', () => {
  beforeEach(() => {
    reportMock.mockClear();
    resolveMock.mockReset();
  });

  it('reports when the caller resolves to a plugin', () => {
    resolveMock.mockReturnValue('my-plugin');
    const srv = new DashboardSrv();
    srv.setCurrent({} as unknown as DashboardModel);
    srv.getCurrent();
    expect(reportMock).toHaveBeenCalledWith(
      expect.objectContaining({ pluginId: 'my-plugin', apiName: 'DashboardSrv.getCurrent' })
    );
  });

  it('does NOT report when the caller is internal (resolver returns "unknown")', () => {
    resolveMock.mockReturnValue('unknown');
    const srv = new DashboardSrv();
    srv.setCurrent({} as unknown as DashboardModel);
    srv.getCurrent();
    expect(reportMock).not.toHaveBeenCalled();
  });

  it('does NOT report when getCurrent returns nothing', () => {
    resolveMock.mockReturnValue('my-plugin');
    const srv = new DashboardSrv();
    srv.getCurrent(); // no setCurrent first
    expect(reportMock).not.toHaveBeenCalled();
  });

  it('reports only once per DashboardSrv instance even on repeated calls', () => {
    resolveMock.mockReturnValue('my-plugin');
    const srv = new DashboardSrv();
    srv.setCurrent({} as unknown as DashboardModel);
    srv.getCurrent();
    srv.getCurrent();
    srv.getCurrent();
    expect(reportMock).toHaveBeenCalledTimes(1);
  });
});
