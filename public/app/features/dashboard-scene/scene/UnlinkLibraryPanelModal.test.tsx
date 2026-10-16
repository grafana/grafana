import { VizPanel } from '@grafana/scenes';

import { isLibraryPanel } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { UnlinkLibraryPanelModal } from './UnlinkLibraryPanelModal';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

describe('UnlinkLibraryPanelModal', () => {
  it('records unlinking the library panel in the undo history on confirm', () => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'table',
      $behaviors: [new LibraryPanelBehavior({ uid: 'lib-uid', name: 'Library panel', isLoaded: true })],
    });
    const modal = new UnlinkLibraryPanelModal({ panelRef: panel.getRef() });
    const dashboard = new DashboardScene({
      isEditing: true,
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
      overlay: modal,
    });
    dashboard.state.sidebar.activate();

    modal.onConfirm();

    expect(isLibraryPanel(panel)).toBe(false);
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);
  });
});
