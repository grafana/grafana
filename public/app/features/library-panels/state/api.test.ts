import { VizPanel } from '@grafana/scenes';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';
import { AutoGridItem } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridItem';
import { vizPanelToPanel } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModel';

import { LibraryElementKind } from '../types';

import { addLibraryPanel, libraryVizPanelToSaveModel } from './api';

const mockPost = jest.fn().mockResolvedValue({ result: {} });
jest.mock('../../../core/services/backend_srv', () => ({
  getBackendSrv: () => ({ post: mockPost }),
}));

describe('addLibraryPanel', () => {
  beforeEach(() => {
    mockPost.mockClear();
  });

  const panelSaveModel = {
    libraryPanel: { name: 'My Panel', uid: 'original-uid' },
    type: 'timeseries',
  };

  it('passes uid to the API when provided', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addLibraryPanel(panelSaveModel as any, 'folder-uid', 'original-uid');

    expect(mockPost).toHaveBeenCalledWith('/api/library-elements', {
      folderUid: 'folder-uid',
      name: 'My Panel',
      model: panelSaveModel,
      kind: LibraryElementKind.Panel,
      uid: 'original-uid',
    });
  });

  it('does not include uid when not provided', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addLibraryPanel(panelSaveModel as any, 'folder-uid');

    expect(mockPost).toHaveBeenCalledWith('/api/library-elements', {
      folderUid: 'folder-uid',
      name: 'My Panel',
      model: panelSaveModel,
      kind: LibraryElementKind.Panel,
    });
  });
});

describe('libraryVizPanelToSaveModel', () => {
  it('uses default gridPos when the parent is an AutoGridItem', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', title: 'Title' });

    const libPanelBehavior = new LibraryPanelBehavior({
      isLoaded: true,
      uid: 'uid',
      name: 'name',
      _loadedPanel: {
        uid: 'uid',
        name: 'name',
        type: 'text',
        model: vizPanelToPanel(panel),
        version: 1,
      },
    });

    panel.setState({ $behaviors: [libPanelBehavior] });
    new AutoGridItem({ key: 'auto-grid-item-1', body: panel });

    const saveModel = libraryVizPanelToSaveModel(panel);

    expect(saveModel.model.gridPos).toEqual({ x: 0, y: 0, w: 6, h: 3 });
  });
});
