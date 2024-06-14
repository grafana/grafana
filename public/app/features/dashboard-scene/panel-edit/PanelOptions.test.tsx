import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { selectors } from '@grafana/e2e-selectors';
import { VizPanel } from '@grafana/scenes';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { overrideRuleTooltipDescription } from 'app/features/dashboard/components/PanelEditor/state/getOptionOverrides';

import { DashboardGridItem } from '../scene/DashboardGridItem';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { activateFullSceneTree } from '../utils/test-utils';
import * as utils from '../utils/utils';

import { PanelOptions } from './PanelOptions';
import { VizPanelManager } from './VizPanelManager';

const OptionsPaneSelector = selectors.components.PanelEditor.OptionsPane;

jest.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '',
  }),
}));

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

const plugin = getPanelPlugin({
  id: 'TestPanel',
}).useFieldConfig({
  standardOptions: {},
  useCustomConfig: (b) => {
    b.addBooleanSwitch({
      name: 'CustomBool',
      path: 'CustomBool',
    })
      .addBooleanSwitch({
        name: 'HiddenFromDef',
        path: 'HiddenFromDef',
        hideFromDefaults: true,
      })
      .addTextInput({
        name: 'TextPropWithCategory',
        path: 'TextPropWithCategory',
        settings: {
          placeholder: 'CustomTextPropPlaceholder',
        },
        category: ['Axis'],
      });
  },
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn().mockReturnValue(plugin),
  }),
}));

// Needed when the panel is not part of an DashboardScene
jest.spyOn(utils, 'getDashboardSceneFor').mockReturnValue(new DashboardScene({}));

interface SetupOptions {
  panel?: VizPanel;
}

function setup(options: SetupOptions = {}) {
  let panel = options.panel;

  if (!panel) {
    panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'text',
      title: 'My title',
      fieldConfig: {
        defaults: {},
        overrides: [
          {
            matcher: { id: 'byName', options: 'SeriesA' },
            properties: [
              {
                id: 'decimals',
                value: 2,
              },
            ],
          },
        ],
      },
    });

    new DashboardGridItem({ body: panel });
  }

  // need to wait for plugin to load
  const vizManager = VizPanelManager.createFor(panel);

  activateFullSceneTree(vizManager);

  const panelOptions = <PanelOptions vizManager={vizManager} searchQuery="" listMode={OptionFilter.All}></PanelOptions>;

  const renderResult = render(panelOptions);

  return { renderResult, vizManager };
}

describe('PanelOptions', () => {
  describe('Can render and edit panel frame options', () => {
    it('Can edit title', async () => {
      const { vizManager } = setup();

      expect(screen.getByLabelText(OptionsPaneSelector.fieldLabel('Panel options Title'))).toBeInTheDocument();

      const input = screen.getByTestId(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'));
      fireEvent.change(input, { target: { value: 'New title' } });

      expect(vizManager.state.panel.state.title).toBe('New title');
    });

    it('Clearing title should set hoverHeader to true', async () => {
      const { vizManager } = setup();

      expect(screen.getByLabelText(OptionsPaneSelector.fieldLabel('Panel options Title'))).toBeInTheDocument();

      const input = screen.getByTestId(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'));
      fireEvent.change(input, { target: { value: '' } });

      expect(vizManager.state.panel.state.title).toBe('');
      expect(vizManager.state.panel.state.hoverHeader).toBe(true);

      fireEvent.change(input, { target: { value: 'Muu' } });
      expect(vizManager.state.panel.state.hoverHeader).toBe(false);
    });
  });

  describe('Field overrides', () => {
    it('Should be rendered', async () => {
      const {} = setup();

      expect(screen.getByLabelText(overrideRuleTooltipDescription)).toBeInTheDocument();
    });

    it('Can update', async () => {
      const {} = setup();

      await userEvent.click(screen.getByLabelText('Remove label'));

      expect(screen.queryByLabelText(overrideRuleTooltipDescription)).not.toBeInTheDocument();
    });

    it('Can delete rule', async () => {
      const {} = setup();

      await userEvent.click(screen.getByLabelText('Remove override'));

      expect(screen.queryByLabelText(overrideRuleTooltipDescription)).not.toBeInTheDocument();
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

    const { renderResult, vizManager } = setup({ panel: panel });

    const input = await renderResult.findByTestId('library panel name input');

    await act(async () => {
      fireEvent.blur(input, { target: { value: 'new library panel name' } });
    });

    expect((vizManager.state.sourcePanel.resolve().parent as LibraryVizPanel).state.name).toBe(
      'new library panel name'
    );
  });
});
