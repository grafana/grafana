import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { VizPanel } from '@grafana/scenes';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';

import { DashboardGridItem } from '../scene/DashboardGridItem';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import * as utils from '../utils/utils';

import { PanelOptions } from './PanelOptions';
import { VizPanelManager } from './VizPanelManager';

const OptionsPaneSelector = selectors.components.PanelEditor.OptionsPane;

jest.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '',
  }),
}));

// Needed when the panel is not part of an DashboardScene
jest.spyOn(utils, 'getDashboardSceneFor').mockReturnValue(new DashboardScene({}));

function setup() {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'text',
    title: 'My title',
  });

  new DashboardGridItem({ body: panel });

  const vizManager = VizPanelManager.createFor(panel);

  const panelOptions = <PanelOptions vizManager={vizManager} searchQuery="" listMode={OptionFilter.All}></PanelOptions>;

  const renderResult = render(panelOptions);

  return { renderResult, vizManager };
}

describe('PanelOptions', () => {
  describe('Can render and edit panel frame options', () => {
    it('Can edit title', async () => {
      const { vizManager } = setup();

      expect(screen.getByLabelText(OptionsPaneSelector.fieldLabel('Panel options Title'))).toBeInTheDocument();

      const input = screen.getByTestId('panel-edit-panel-title-input');
      fireEvent.change(input, { target: { value: 'New title' } });

      expect(vizManager.state.panel.state.title).toBe('New title');
    });

    it('Clearing title should set hoverHeader to true', async () => {
      const { vizManager } = setup();

      expect(screen.getByLabelText(OptionsPaneSelector.fieldLabel('Panel options Title'))).toBeInTheDocument();

      const input = screen.getByTestId('panel-edit-panel-title-input');
      fireEvent.change(input, { target: { value: '' } });

      expect(vizManager.state.panel.state.title).toBe('');
      expect(vizManager.state.panel.state.hoverHeader).toBe(true);

      fireEvent.change(input, { target: { value: 'Muu' } });
      expect(vizManager.state.panel.state.hoverHeader).toBe(false);
    });
  });

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

    new DashboardGridItem({ body: libraryPanel });

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

    new DashboardGridItem({ body: libraryPanel });

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
