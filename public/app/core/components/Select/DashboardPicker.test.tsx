import { noop } from 'lodash';
import { Props } from 'react-virtualized-auto-sizer';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { defaultDashboard as defaultDashboardData } from '@grafana/schema';
import {
  DashboardV2Spec,
  defaultDashboardV2Spec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardSearchItemType } from 'app/features/search/types';
import { DashboardDTO } from 'app/types';

import { DashboardPicker } from './DashboardPicker';

jest.mock('app/core/services/backend_srv', () => ({
  ...jest.requireActual('app/core/services/backend_srv'),
  backendSrv: {
    ...jest.requireActual('app/core/services/backend_srv').backendSrv,
    search: jest.fn(),
  },
}));

const getDashboardDTO = jest.fn();

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () => ({
    getDashboardDTO: getDashboardDTO,
  }),
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: Props) =>
    children({
      height: 600,
      scaledHeight: 600,
      scaledWidth: 1,
      width: 1,
    });
});

jest.mocked(backendSrv.search).mockResolvedValue([
  {
    uid: 'dash-1',
    type: DashboardSearchItemType.DashDB,
    title: 'Dashboard 1',
    uri: '',
    url: '',
    tags: [],
    isStarred: false,
  },
  {
    uid: 'dash-2',
    type: DashboardSearchItemType.DashDB,
    title: 'Dashboard 2',
    uri: '',
    url: '',
    tags: [],
    isStarred: false,
  },
  {
    uid: 'dash-3',
    type: DashboardSearchItemType.DashDB,
    title: 'Dashboard 3',
    uri: '',
    url: '',
    tags: [],
    isStarred: false,
  },
]);

const mockDashboard: DashboardDTO = {
  dashboard: {
    ...defaultDashboardData,
    uid: 'dash-2',
    title: 'Dashboard 2',
  },
  meta: {},
};

const mockDashboardV2: DashboardWithAccessInfo<DashboardV2Spec> = {
  apiVersion: 'v2alpha0',
  kind: 'DashboardWithAccessInfo',
  spec: {
    ...defaultDashboardV2Spec(),
    title: 'Dashboard 2',
  },
  metadata: {
    name: 'dash-2',
    resourceVersion: '0',
    creationTimestamp: '0',
    annotations: {},
  },
  access: {
    canEdit: true,
    canSave: true,
    canStar: true,
    canShare: true,
  },
};

describe('DashboardPicker', () => {
  describe.each([
    ['v1', mockDashboard],
    ['v2', mockDashboardV2],
  ])('Dashboard %s', (format, dashboard) => {
    beforeEach(() => {
      config.featureToggles.useV2DashboardsAPI = format === 'v2';
      getDashboardDTO.mockResolvedValue(dashboard);
    });

    it('should fetch and display dashboards', async () => {
      render(<DashboardPicker value="dash-2" onChange={noop} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboards/Dashboard 2')).toBeInTheDocument();
        expect(getDashboardDTO).toHaveBeenCalledWith('dash-2', undefined);
      });
    });

    it.skip('should search for dashboards', async () => {
      render(<DashboardPicker onChange={noop} />);

      await userEvent.type(screen.getByRole('combobox'), 'Dashboard 2');

      await waitFor(() => {
        expect(screen.getByText('Dashboards/Dashboard 2')).toBeInTheDocument();
      });

      expect(backendSrv.search).toHaveBeenCalledWith({ type: 'dash-db', query: 'Dashboard 2', limit: 100 });
    });
  });
});
