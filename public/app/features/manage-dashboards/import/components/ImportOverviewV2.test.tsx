import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import {
  defaultSpec,
  defaultGridLayoutKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { listFolders } from 'app/features/browse-dashboards/api/services';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

import { type DashboardInputs, DashboardSource, InputType } from '../../types';

import { ImportOverviewV2 } from './ImportOverviewV2';

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: jest.fn(),
}));

jest.mock('app/features/browse-dashboards/api/services', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/services'),
  listFolders: jest.fn().mockResolvedValue([]),
  listDashboards: jest.fn().mockResolvedValue([]),
}));

jest.mock('@grafana/api-clients/rtkq/quotas/v0alpha1', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/quotas/v0alpha1'),
  invalidateQuotaUsage: jest.fn(),
}));

jest.mock('../utils/validation', () => ({
  validateTitle: jest.fn().mockResolvedValue(true),
  validateUid: jest.fn().mockResolvedValue(true),
}));

jest.mock('app/core/components/Select/FolderPicker', () => ({
  FolderPicker: ({ value, onChange }: { value: string; onChange: (val: string, title: string) => void }) => (
    <input data-testid="folder-picker" value={value} onChange={(e) => onChange?.(e.target.value, 'Test Folder')} />
  ),
}));

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: ({
    onChange,
    pluginId,
    current,
  }: {
    onChange: (ds: { uid: string; type: string; name: string }) => void;
    pluginId: string;
    current?: { uid: string; type: string };
  }) => (
    <input
      data-testid={`datasource-picker-${pluginId}`}
      value={current?.uid || ''}
      onChange={(e) =>
        onChange({
          uid: e.target.value,
          type: pluginId,
          name: `${pluginId} instance`,
        })
      }
    />
  ),
}));

const mockGetDashboardAPI = jest.mocked(getDashboardAPI);

describe('ImportOverviewV2', () => {
  let saveDashboard = jest.fn().mockResolvedValue({ url: '/d/test-uid/test-dashboard' });

  const mockInputs: DashboardInputs = {
    dataSources: [
      {
        name: 'Prometheus',
        pluginId: 'prometheus',
        type: InputType.DataSource,
        description: 'Select a Prometheus data source',
        info: 'Select prometheus',
        label: 'Prometheus',
        value: '',
      },
    ],
    constants: [],
    libraryPanels: [],
  };

  function renderCmp(layout: DashboardV2Spec['layout'], dashboardUid?: string) {
    const dashboard: DashboardV2Spec = { ...defaultSpec(), title: 'Test Dashboard', layout };
    render(
      <ImportOverviewV2
        dashboard={dashboard}
        dashboardUid={dashboardUid}
        inputs={mockInputs}
        meta={{ updatedAt: '', orgName: '' }}
        source={DashboardSource.Json}
        folderUid="test-folder"
        onCancel={jest.fn()}
      />
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    saveDashboard = jest.fn().mockResolvedValue({ url: '/d/test-uid/test-dashboard' });
    mockGetDashboardAPI.mockResolvedValue({
      saveDashboard,
      getDashboardDTO: jest.fn(),
      deleteDashboard: jest.fn(),
      listDeletedDashboards: jest.fn(),
      restoreDashboard: jest.fn(),
      listDashboardHistory: jest.fn(),
      getDashboardHistoryVersions: jest.fn(),
      restoreDashboardVersion: jest.fn(),
    });
  });

  describe('float grid items warning', () => {
    it('does not show warning when dashboard has no float grid items', async () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: {
            element: { kind: 'ElementReference', name: 'panel-1' },
            x: 0,
            y: 0,
            width: 12,
            height: 8,
          },
        },
      ];

      renderCmp(layout);
      await waitFor(() => {
        expect(
          screen.queryByTestId(selectors.components.ImportDashboardForm.floatGridItemsWarning)
        ).not.toBeInTheDocument();
      });
    });

    it('shows warning when dashboard has float grid items', async () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: {
            element: { kind: 'ElementReference', name: 'panel-1' },
            x: 1.5,
            y: 0,
            width: 12,
            height: 8,
          },
        },
      ];

      renderCmp(layout);
      await waitFor(() => {
        expect(
          screen.queryByTestId(selectors.components.ImportDashboardForm.floatGridItemsWarning)
        ).toBeInTheDocument();
      });
    });
  });

  describe('onSubmit', () => {
    let user = userEvent.setup();

    beforeEach(() => {
      user = userEvent.setup();
    });

    it('truncates float grid items before saving', async () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: {
            element: { kind: 'ElementReference', name: 'panel-1' },
            x: 1.7,
            y: 2.3,
            width: 12.5,
            height: 8.9,
          },
        },
      ];

      renderCmp(layout);
      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));
      await waitFor(() => {
        expect(saveDashboard).toHaveBeenCalled();
      });

      const savedData = saveDashboard.mock.calls[0][0];
      const savedLayout = savedData.dashboard.layout;
      // Math.trunc truncates toward zero (same as Go's int())
      expect(savedLayout.spec.items[0].spec.x).toBe(1);
      expect(savedLayout.spec.items[0].spec.y).toBe(2);
      expect(savedLayout.spec.items[0].spec.width).toBe(12);
      expect(savedLayout.spec.items[0].spec.height).toBe(8);
    });

    it('preserves grid items when there are no floats', async () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: {
            element: { kind: 'ElementReference', name: 'panel-1' },
            x: 0,
            y: 0,
            width: 12,
            height: 8,
          },
        },
      ];

      renderCmp(layout);
      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));
      await waitFor(() => {
        expect(saveDashboard).toHaveBeenCalled();
      });

      const savedData = saveDashboard.mock.calls[0][0];
      const savedLayout = savedData.dashboard.layout;
      expect(savedLayout.spec.items[0].spec.x).toBe(0);
      expect(savedLayout.spec.items[0].spec.y).toBe(0);
      expect(savedLayout.spec.items[0].spec.width).toBe(12);
      expect(savedLayout.spec.items[0].spec.height).toBe(8);
    });

    it('sends preserved resource uid in k8s.name when provided', async () => {
      const layout = defaultGridLayoutKind();
      renderCmp(layout, 'resource-uid');

      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));

      await waitFor(() => {
        expect(saveDashboard).toHaveBeenCalled();
      });

      const savedData = saveDashboard.mock.calls[0][0];
      expect(savedData.k8s?.name).toBe('resource-uid');
    });

    it('allows overriding preserved uid before save', async () => {
      const layout = defaultGridLayoutKind();
      renderCmp(layout, 'resource-uid');

      await user.click(screen.getByRole('button', { name: /change uid/i }));

      const uidField = document.querySelector('input[name="k8s.name"]') as HTMLInputElement;
      await user.clear(uidField);
      await user.type(uidField, 'custom-uid');

      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));

      await waitFor(() => {
        expect(saveDashboard).toHaveBeenCalled();
      });

      const savedData = saveDashboard.mock.calls[0][0];
      expect(savedData.k8s?.name).toBe('custom-uid');
    });

    it('refetches the destination folder children after import to invalidate the browse cache', async () => {
      const layout = defaultGridLayoutKind();
      renderCmp(layout);

      const datasourcePicker = screen.getByTestId('datasource-picker-prometheus');
      await user.type(datasourcePicker, 'prom-uid');
      await user.click(screen.getByRole('button', { name: /import/i }));

      await waitFor(() => {
        expect(saveDashboard).toHaveBeenCalled();
      });

      // refetchChildren thunk calls listFolders with the destination folder uid
      await waitFor(() => {
        expect(listFolders).toHaveBeenCalledWith('test-folder', undefined, 1, expect.any(Number));
      });
    });
  });
});
