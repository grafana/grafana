import { VizPanel } from '@grafana/scenes';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';
import { AutoGridItem } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridItem';

import { libraryVizPanelToSaveModel } from './api';

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
        title: 'Title',
        type: 'text',
        model: {},
        version: 1,
      },
    });

    panel.setState({ $behaviors: [libPanelBehavior] });
    new AutoGridItem({ key: 'auto-grid-item-1', body: panel });

    const saveModel = libraryVizPanelToSaveModel(panel);

    expect(saveModel.model.gridPos).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
