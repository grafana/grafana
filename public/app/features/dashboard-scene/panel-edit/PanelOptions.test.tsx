import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { standardEditorsRegistry, standardFieldConfigEditorRegistry, ThresholdsMode } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { overrideRuleTooltipDescription } from 'app/features/dashboard/components/PanelEditor/state/getOptionOverrides';

import { DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { activateFullSceneTree } from '../utils/test-utils';
import * as utils from '../utils/utils';

import { PanelOptions } from './PanelOptions';
import { PanelOptionsPane } from './PanelOptionsPane';

jest.mock('app/features/dashboard/components/GenAI/LazyGenAIButtons', () => ({
  LazyGenAIPanelTitleButton: () => null,
  LazyGenAIPanelDescriptionButton: () => null,
}));

const OptionsPaneSelector = selectors.components.PanelEditor.OptionsPane;

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

async function setup(options: SetupOptions = {}) {
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
  const panelOptionsScene = new PanelOptionsPane({
    panelRef: panel.getRef(),
    searchQuery: '',
    listMode: OptionFilter.All,
  });

  activateFullSceneTree(panelOptionsScene);
  panel.activate();

  const panelOptions = <PanelOptions panel={panel} searchQuery="" listMode={OptionFilter.All}></PanelOptions>;
  // Registry editors are lazy, so let them resolve before the test asserts
  const renderResult = await act(async () => render(panelOptions));

  return { renderResult, panelOptionsScene, panel };
}

describe('PanelOptions', () => {
  describe('Can render and edit panel frame options', () => {
    it('Can edit title', async () => {
      const { panel } = await setup();

      expect(screen.getByTestId(OptionsPaneSelector.fieldLabel('Panel options Title'))).toBeInTheDocument();

      const input = screen.getByTestId(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'));
      fireEvent.change(input, { target: { value: 'New title' } });

      expect(panel.state.title).toBe('New title');
    });

    it('Clearing title should set hoverHeader to true', async () => {
      const { panel } = await setup();

      expect(screen.getByTestId(OptionsPaneSelector.fieldLabel('Panel options Title'))).toBeInTheDocument();

      const input = screen.getByTestId(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'));
      fireEvent.change(input, { target: { value: '' } });

      expect(panel.state.title).toBe('');
      expect(panel.state.hoverHeader).toBe(true);

      fireEvent.change(input, { target: { value: 'Muu' } });
      expect(panel.state.hoverHeader).toBe(false);
    });
  });

  describe('Field overrides', () => {
    it('Should be rendered', async () => {
      await setup();

      expect(screen.getByText(overrideRuleTooltipDescription)).toBeInTheDocument();
    });

    it('Can update', async () => {
      await setup();

      await userEvent.click(screen.getByLabelText('Remove property'));

      expect(screen.queryByText(overrideRuleTooltipDescription)).not.toBeInTheDocument();
    });

    it('Can delete rule', async () => {
      await setup();

      await userEvent.click(screen.getByLabelText('Remove override'));

      expect(screen.queryByText(overrideRuleTooltipDescription)).not.toBeInTheDocument();
    });
  });

  describe('varMappings expression mode', () => {
    // deleting a rule in an earlier test persists a collapsed state for the override group
    beforeEach(() => {
      window.localStorage.clear();
    });

    const setupWithExpressions = () => {
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'text',
        fieldConfig: {
          defaults: { min: 0, varMappings: { min: '$min' } },
          overrides: [
            {
              matcher: { id: 'byName', options: 'SeriesA' },
              properties: [
                { id: 'decimals', value: 2 },
                { id: 'varMappings.decimals', value: '$decimals' },
              ],
            },
          ],
        },
      });
      new DashboardGridItem({ body: panel });
      return setup({ panel });
    };

    const getMinInput = () => screen.getByLabelText(/^Min/);
    const getDecimalsOverrideInput = () =>
      within(screen.getByTestId(selectors.components.OptionsGroup.group('panel-options-override-0'))).getByLabelText(
        /Decimals/
      );

    it('is absent with the flag off', async () => {
      await setupWithExpressions();

      const minInput = getMinInput();
      expect(minInput).toHaveAttribute('type', 'number');
      expect(minInput).toHaveValue(0);

      const decimalsInput = getDecimalsOverrideInput();
      expect(decimalsInput).toHaveAttribute('type', 'number');
      expect(decimalsInput).toHaveValue(2);
    });

    describe('with the flag on', () => {
      beforeEach(() => {
        setTestFlags({ 'grafana.panelOptionInterpolation': true });
      });

      // reset in afterAll rather than afterEach: RTL's cleanup runs after this
      // block's afterEach, so resetting per-test would emit a flag change into a
      // still-mounted component and trip the act() warning
      afterAll(() => {
        setTestFlags();
      });

      it('shows the stored expressions in text inputs', async () => {
        await setupWithExpressions();

        const minInput = getMinInput();
        expect(minInput).toHaveAttribute('type', 'text');
        expect(minInput).toHaveValue('$min');

        const decimalsInput = getDecimalsOverrideInput();
        expect(decimalsInput).toHaveAttribute('type', 'text');
        expect(decimalsInput).toHaveValue('$decimals');
      });

      it('re-keys threshold step expressions when steps are re-sorted, added and removed', async () => {
        const panel = new VizPanel({
          key: 'panel-1',
          pluginId: 'text',
          fieldConfig: {
            defaults: {
              thresholds: {
                mode: ThresholdsMode.Absolute,
                steps: [
                  { value: -Infinity, color: 'green' },
                  { value: 50, color: 'orange' },
                  { value: 80, color: 'red' },
                ],
              },
              varMappings: { 'thresholds.steps.1': '$warn' },
            },
            overrides: [],
          },
        });
        new DashboardGridItem({ body: panel });
        await setup({ panel });

        const stepExpressions = () => panel.state.fieldConfig.defaults.varMappings;
        const stepValues = () => panel.state.fieldConfig.defaults.thresholds?.steps.map((step) => step.value);

        // inputs are listed from the highest step down
        expect(screen.getByRole('textbox', { name: 'Threshold 2' })).toHaveValue('$warn');

        const highest = screen.getByRole('textbox', { name: 'Threshold 1' });
        await userEvent.clear(highest);
        await userEvent.type(highest, '10');
        await userEvent.tab();

        expect(stepValues()).toEqual([-Infinity, 10, 50]);
        expect(stepExpressions()).toEqual({ 'thresholds.steps.2': '$warn' });
        expect(JSON.stringify(panel.state.fieldConfig)).not.toContain('valueExpr');

        await userEvent.click(screen.getByRole('button', { name: 'Add threshold' }));
        expect(stepValues()).toEqual([-Infinity, 10, 50, 60]);
        expect(stepExpressions()).toEqual({ 'thresholds.steps.2': '$warn' });

        await userEvent.click(screen.getByRole('button', { name: 'Remove threshold 3' }));
        expect(stepValues()).toEqual([-Infinity, 50, 60]);
        expect(stepExpressions()).toEqual({ 'thresholds.steps.1': '$warn' });

        await userEvent.click(screen.getByRole('button', { name: 'Remove threshold 2' }));
        expect(stepValues()).toEqual([-Infinity, 60]);
        expect(stepExpressions()).toBeUndefined();
      });

      it('writes a typed expression to defaults.varMappings', async () => {
        const { panel } = await setupWithExpressions();

        const minInput = getMinInput();
        await userEvent.clear(minInput);
        await userEvent.type(minInput, '$other{Enter}');

        const { defaults } = panel.state.fieldConfig;
        expect(defaults.varMappings).toEqual({ min: '$other' });
        expect(defaults.min).toBe(0);
      });
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

    const libraryPanel = new LibraryPanelBehavior({
      isLoaded: true,
      uid: libraryPanelModel.uid,
      name: libraryPanelModel.name,
      _loadedPanel: libraryPanelModel,
    });

    panel.setState({ $behaviors: [libraryPanel] });

    new DashboardGridItem({ body: panel });

    const { renderResult } = await setup({ panel: panel });

    const input = await renderResult.findByTestId('library panel name input');

    await act(async () => {
      fireEvent.blur(input, { target: { value: 'new library panel name' } });
    });

    expect((panel.state.$behaviors![0] as LibraryPanelBehavior).state.name).toBe('new library panel name');
  });
});
