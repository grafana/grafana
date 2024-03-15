import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';

import { SceneGridItem, VizPanel } from '@grafana/scenes';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';

import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';

import { PanelOptions } from './PanelOptions';
import { VizPanelManager } from './VizPanelManager';

jest.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '',
  }),
}));

describe('PanelOptions', () => {
  it('gets library panel options when the editing a library panel', async () => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'text',
    });

    const libraryPanelModel = {
      title: 'title',
      uid: 'uid',
      name: 'libraryPanelName',
      model: vizPanelToPanel(panel),
      type: 'panel',
      version: 1,
    };

    const libraryPanel = new LibraryVizPanel({
      isLoaded: true,
      title: libraryPanelModel.title,
      uid: libraryPanelModel.uid,
      name: libraryPanelModel.name,
      panelKey: panel.state.key!,
      panel: panel,
      _loadedPanel: libraryPanelModel,
    });

    new SceneGridItem({ body: libraryPanel });

    const panelManger = VizPanelManager.createFor(panel);

    const panelOptions = (
      <PanelOptions vizManager={panelManger} searchQuery="" listMode={OptionFilter.All}></PanelOptions>
    );

    const r = render(panelOptions);
    const input = await r.findByTestId('library panel name input');
    await act(async () => {
      fireEvent.blur(input, { target: { value: 'new library panel name' } });
    });

    expect((panelManger.state.sourcePanel.resolve().parent as LibraryVizPanel).state.name).toBe(
      'new library panel name'
    );
  });
});
