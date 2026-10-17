import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { SceneTimeRange } from '@grafana/scenes';
import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { VersionsEditView } from './VersionsEditView';

const mockListDashboardHistory = jest.fn();

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () =>
    Promise.resolve({
      listDashboardHistory: mockListDashboardHistory,
    }),
}));

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  useGetDisplayMappingQuery: () => ({ data: undefined }),
}));

describe('VersionsEditView pagination', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows more versions when the API returns a continuation token', async () => {
    mockListDashboardHistory.mockResolvedValueOnce({
      metadata: { continue: 'next-page-token' },
      items: [createTestResource(3), createTestResource(2)],
    });

    const versionsView = new VersionsEditView({});
    const dashboard = new DashboardScene({
      $timeRange: new SceneTimeRange({}),
      title: 'test dashboard',
      uid: 'dash-1',
      version: 3,
      meta: { canEdit: true },
      editview: versionsView,
    });

    activateFullSceneTree(dashboard);
    dashboard.onEnterEditMode();
    versionsView.activate();

    await new Promise(process.nextTick);

    render(
      <TestProvider>
        <versionsView.Component model={versionsView} />
      </TestProvider>
    );

    expect(await screen.findByRole('button', { name: /show more versions/i })).toBeEnabled();
  });
});

function createTestResource(version: number) {
  return {
    apiVersion: 'v1beta1',
    kind: 'Dashboard',
    metadata: {
      name: '_U4zObQMz',
      generation: version,
      creationTimestamp: '2024-01-01T00:00:00Z',
      annotations: {
        'grafana.app/updatedBy': 'admin',
        'grafana.app/message': '',
      },
    },
    spec: { version },
  };
}
