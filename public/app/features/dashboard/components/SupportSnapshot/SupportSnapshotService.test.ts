import { PanelModel } from '../../state/PanelModel';

import { SnapshotTab, SupportSnapshotService } from './SupportSnapshotService';

describe('SupportSnapshotService', () => {
  const panel = new PanelModel({});

  it('Can create it with default state', () => {
    const service = new SupportSnapshotService(panel);
    expect(service.state.currentTab).toBe(SnapshotTab.Support);
  });

  // it("Can can build support snapshot dashboard", () => {
  //   const service = new SupportSnapshotService(panel);
  //   service.buildDebugDashboard();
  //   expect(service.state.currentTab).toBe(SnapshotTab.Support)
  // })
});
