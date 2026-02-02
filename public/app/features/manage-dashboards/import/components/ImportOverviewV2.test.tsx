import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import {
  defaultSpec,
  defaultGridLayoutKind,
  Spec as DashboardV2Spec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

import { DashboardInputs, DashboardSource, InputType } from '../../types';

import { ImportOverviewV2 } from './ImportOverviewV2';

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: jest.fn(),
}));

jest.mock('../utils/validation', () => ({
  validateTitle: jest.fn().mockResolvedValue(true),
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

  function renderCmp(layout: DashboardV2Spec['layout']) {
    const dashboard: DashboardV2Spec = { ...defaultSpec(), title: 'Test Dashboard', layout };
    render(
      <ImportOverviewV2
        dashboard={dashboard}
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
    mockGetDashboardAPI.mockReturnValue({
      saveDashboard,
      getDashboardDTO: jest.fn(),
      deleteDashboard: jest.fn(),
      listDeletedDashboards: jest.fn(),
      restoreDashboard: jest.fn(),
    });
  });

  describe('float grid items', () => {
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

    it('does not truncate grid items when there are no floats', async () => {
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
  });
});
