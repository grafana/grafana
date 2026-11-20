import { type CorsWorker } from 'app/core/utils/CorsWorker';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import * as createDetectChangesWorker from './createDetectChangesWorker';
import { type DashboardChangesRequest, type DashboardChangesResponse } from './shared';

describe('SaveDashboardDrawer', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('when opened before a pending check replies, unsaved edits are still detected', () => {
    const worker = {
      postMessage: jest.fn<void, [DashboardChangesRequest]>(),
      onmessage: null as ((event: MessageEvent<DashboardChangesResponse>) => void) | null,
      terminate: jest.fn(),
    };
    jest.spyOn(createDetectChangesWorker, 'createWorker').mockReturnValue(worker as unknown as CorsWorker);

    const dashboard = new DashboardScene({
      title: 'Initial title',
      uid: 'dashboard-1',
      isEditing: true,
      isDirty: false,
      $data: undefined,
    });
    dashboard.setInitialSaveModel({ title: 'Initial title', schemaVersion: 30 });
    const deactivateDashboard = dashboard.activate();

    try {
      dashboard.setState({ title: 'Before drawer' });

      const oldRequest = worker.postMessage.mock.calls.at(-1)![0];

      const drawer = new SaveDashboardDrawer({ dashboardRef: dashboard.getRef() });
      dashboard.showModal(drawer);

      const deactivateDrawer = drawer.activate();

      try {
        worker.onmessage!(
          new MessageEvent('message', { data: { generation: oldRequest.generation, hasChanges: true } })
        );

        expect(dashboard.state.isDirty).toBe(true);
      } finally {
        dashboard.closeModal();
        deactivateDrawer();
      }

      dashboard.setState({ title: 'Edited after close' });
      const freshRequest = worker.postMessage.mock.calls.at(-1)![0];
      worker.onmessage!(
        new MessageEvent('message', { data: { generation: freshRequest.generation, hasChanges: true } })
      );

      expect(dashboard.state.title).toBe('Edited after close');
      expect(dashboard.state.isDirty).toBe(true);
    } finally {
      deactivateDashboard();
    }
  });
});
