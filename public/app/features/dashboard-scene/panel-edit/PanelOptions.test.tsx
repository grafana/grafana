import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { standardEditorsRegistry, standardFieldConfigEditorRegistry, ThresholdsMode } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable, sceneGraph, SceneVariableSet, VizPanel } from '@grafana/scenes';
import { mockComboboxRect } from '@grafana/test-utils';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { overrideRuleTooltipDescription } from 'app/features/dashboard/components/PanelEditor/state/getOptionOverrides';
import { defaultGraphConfig, getGraphFieldConfig } from 'app/plugins/panel/timeseries/config';

import { DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { activateFullSceneTree } from '../utils/test-utils';
import * as utils from '../utils/utils';

import { PanelOptions } from './PanelOptions';
import { PanelOptionsPane } from './PanelOptionsPane';

jest.mock('app/core/components/SuggestionsInput/getVariableSuggestions', () => ({
  getVariableSuggestions: () => [
    { value: 't', label: 't', origin: 'template' },
    { value: 'other', label: 'other', origin: 'template' },
  ],
}));

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

// The real timeseries field config, so its radios and switches run through the real registry
const timeseriesPlugin = getPanelPlugin({ id: 'timeseries' }).useFieldConfig(getGraphFieldConfig(defaultGraphConfig));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn((id: string) => (id === 'timeseries' ? timeseriesPlugin : plugin)),
  }),
}));

// Puts the panel in a dashboard of that schema version, or only in a grid item without one
function placeInDashboard(panel: VizPanel, serializerVersion?: 'v1' | 'v2') {
  if (!serializerVersion) {
    new DashboardGridItem({ body: panel });
    return;
  }
  return new DashboardScene(
    {
      // The same names the mocked suggestions give editors rendered without a dashboard
      $variables: new SceneVariableSet({
        variables: [new CustomVariable({ name: 't', query: '1' }), new CustomVariable({ name: 'other', query: '2' })],
      }),
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    },
    serializerVersion
  );
}

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

    const setupWithExpressions = (serializerVersion?: 'v1' | 'v2') => {
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
      placeInDashboard(panel, serializerVersion);
      return setup({ panel });
    };

    const getMinInput = () => screen.getByLabelText(/^Min/);
    const getDecimalsOverrideInput = () =>
      within(screen.getByTestId(selectors.components.OptionsGroup.group('panel-options-override-0'))).getByLabelText(
        /Decimals/
      );

    it('is absent with the flag off', async () => {
      await setupWithExpressions('v2');

      const minInput = getMinInput();
      expect(minInput).toHaveAttribute('type', 'number');
      expect(minInput).toHaveValue(0);

      const decimalsInput = getDecimalsOverrideInput();
      expect(decimalsInput).toHaveAttribute('type', 'number');
      expect(decimalsInput).toHaveValue(2);
    });

    it('lets a typed number replace the saved expressions with the flag off', async () => {
      const { panel } = await setupWithExpressions('v2');

      const minInput = getMinInput();
      await userEvent.clear(minInput);
      await userEvent.type(minInput, '5');
      await userEvent.tab();

      const decimalsInput = getDecimalsOverrideInput();
      await userEvent.clear(decimalsInput);
      await userEvent.type(decimalsInput, '1');
      await userEvent.tab();

      const { defaults, overrides } = panel.state.fieldConfig;
      expect(defaults.min).toBe(5);
      expect(defaults.varMappings).toBeUndefined();
      expect(overrides[0].properties).toEqual([{ id: 'decimals', value: 1 }]);
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

      it('keeps the plain editors on a v1 dashboard, where a typed number drops a saved expression', async () => {
        const { panel } = await setupWithExpressions('v1');

        const minInput = getMinInput();
        expect(minInput).toHaveAttribute('type', 'number');
        expect(minInput).toHaveValue(0);

        await userEvent.clear(minInput);
        await userEvent.type(minInput, '5');
        await userEvent.tab();

        expect(panel.state.fieldConfig.defaults.min).toBe(5);
        expect(panel.state.fieldConfig.defaults.varMappings).toBeUndefined();
      });

      it('shows the stored expressions in text inputs', async () => {
        await setupWithExpressions('v2');

        const minInput = getMinInput();
        expect(minInput).not.toHaveAttribute('type', 'number');
        expect(minInput).toHaveValue('$min');

        const decimalsInput = getDecimalsOverrideInput();
        expect(decimalsInput).not.toHaveAttribute('type', 'number');
        expect(decimalsInput).toHaveValue('$decimals');
      });

      it('keeps threshold step expressions on their steps when steps are re-sorted, added and removed', async () => {
        const panel = new VizPanel({
          key: 'panel-1',
          pluginId: 'text',
          fieldConfig: {
            defaults: {
              thresholds: {
                mode: ThresholdsMode.Absolute,
                steps: [
                  { value: -Infinity, color: 'green' },
                  { value: 50, color: 'orange', valueExpr: '$warn' },
                  { value: 80, color: 'red' },
                ],
              },
            },
            overrides: [],
          },
        });
        placeInDashboard(panel, 'v2');
        await setup({ panel });

        const steps = () =>
          panel.state.fieldConfig.defaults.thresholds?.steps.map(({ value, valueExpr }) => [value, valueExpr]);

        // inputs are listed from the highest step down
        expect(screen.getByRole('textbox', { name: 'Threshold 2' })).toHaveValue('$warn');

        const highest = screen.getByRole('textbox', { name: 'Threshold 1' });
        await userEvent.clear(highest);
        await userEvent.type(highest, '10');
        await userEvent.tab();

        expect(steps()).toEqual([
          [-Infinity, undefined],
          [10, undefined],
          [50, '$warn'],
        ]);
        expect(panel.state.fieldConfig.defaults.varMappings).toBeUndefined();

        await userEvent.click(screen.getByRole('button', { name: 'Add threshold' }));
        expect(steps()).toEqual([
          [-Infinity, undefined],
          [10, undefined],
          [50, '$warn'],
          [60, undefined],
        ]);

        await userEvent.click(screen.getByRole('button', { name: 'Remove threshold 3' }));
        expect(steps()).toEqual([
          [-Infinity, undefined],
          [50, '$warn'],
          [60, undefined],
        ]);
      });

      it('takes a unit expression through the unit picker custom value and keeps the stored unit', async () => {
        const panel = new VizPanel({
          key: 'panel-1',
          pluginId: 'text',
          fieldConfig: { defaults: { unit: 'short' }, overrides: [] },
        });
        placeInDashboard(panel, 'v2');
        await setup({ panel });

        const getUnitInput = () =>
          within(screen.getByTestId(OptionsPaneSelector.fieldLabel('Standard options Unit'))).getByRole('textbox');
        // focusing selects the current unit, so typing replaces it
        await userEvent.click(getUnitInput());
        await userEvent.keyboard('$unit');
        await userEvent.click(await screen.findByText('Custom unit: $unit'));

        expect(panel.state.fieldConfig.defaults).toMatchObject({ unit: 'short', varMappings: { unit: '$unit' } });
        expect(getUnitInput()).toHaveValue('$unit');
      });

      it('writes a typed expression to defaults.varMappings', async () => {
        const { panel } = await setupWithExpressions('v2');

        const minInput = getMinInput();
        await userEvent.clear(minInput);
        // Escape closes the variable list, so Enter commits the typed text
        await userEvent.type(minInput, '$other{Escape}{Enter}');

        const { defaults } = panel.state.fieldConfig;
        expect(defaults.varMappings).toEqual({ min: '$other' });
        expect(defaults.min).toBe(0);
      });

      it('suggests dashboard variables on $ and writes the picked one', async () => {
        const { panel } = await setupWithExpressions('v2');

        const minInput = getMinInput();
        await userEvent.clear(minInput);
        await userEvent.type(minInput, '$');
        expect(await screen.findByText('other')).toBeInTheDocument();

        await userEvent.keyboard('{ArrowDown}{Enter}');

        expect(panel.state.fieldConfig.defaults.varMappings).toEqual({ min: '${other}' });
        expect(getMinInput()).toHaveValue('${other}');
      });
    });
  });

  describe('select, radio, switch and slider expressions', () => {
    beforeEach(() => {
      window.localStorage.clear();
      mockComboboxRect();
    });

    const setupTimeseries = (fieldConfig: VizPanel['state']['fieldConfig'], serializerVersion: 'v1' | 'v2' = 'v2') => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', fieldConfig });
      placeInDashboard(panel, serializerVersion);
      return setup({ panel });
    };

    const getDrawStyleField = () => screen.getByTestId(OptionsPaneSelector.fieldLabel('Graph styles Style'));
    const getOverrideGroup = () =>
      screen.getByTestId(selectors.components.OptionsGroup.group('panel-options-override-0'));

    it('has no variable buttons with the flag off, and a plain pick drops saved expressions', async () => {
      const { panel } = await setupTimeseries({
        defaults: { custom: { drawStyle: 'line' }, varMappings: { 'custom.drawStyle': '$style' } },
        overrides: [
          {
            matcher: { id: 'byName', options: 'SeriesA' },
            properties: [
              { id: 'custom.drawStyle', value: 'line' },
              { id: 'varMappings.custom.drawStyle', value: '$style' },
            ],
          },
        ],
      });

      expect(screen.queryByRole('button', { name: 'Use variable' })).not.toBeInTheDocument();
      expect(within(getDrawStyleField()).getByRole('radio', { name: 'Lines' })).toBeChecked();

      await userEvent.click(within(getDrawStyleField()).getByRole('radio', { name: 'Bars' }));
      await userEvent.click(within(getOverrideGroup()).getByRole('radio', { name: 'Points' }));

      const { defaults, overrides } = panel.state.fieldConfig;
      expect(defaults).toMatchObject({ custom: { drawStyle: 'bars' } });
      expect(defaults.varMappings).toBeUndefined();
      expect(overrides[0].properties).toEqual([{ id: 'custom.drawStyle', value: 'points' }]);
    });

    describe('with the flag on', () => {
      beforeEach(() => {
        setTestFlags({ 'grafana.panelOptionInterpolation': true });
      });

      afterAll(() => {
        setTestFlags();
      });

      it('keeps the plain controls on a v1 dashboard', async () => {
        await setupTimeseries({ defaults: { custom: { drawStyle: 'line' } }, overrides: [] }, 'v1');

        expect(screen.queryByRole('button', { name: 'Use variable' })).not.toBeInTheDocument();
      });

      it('writes a picked variable for draw style to defaults.varMappings and removes it with the toggle', async () => {
        const { panel } = await setupTimeseries({ defaults: { custom: { drawStyle: 'line' } }, overrides: [] });

        await userEvent.click(within(getDrawStyleField()).getByRole('button', { name: 'Use variable' }));
        await userEvent.click(await screen.findByRole('option', { name: 'other' }));

        expect(panel.state.fieldConfig.defaults.varMappings).toEqual({ 'custom.drawStyle': '${other}' });
        expect(panel.state.fieldConfig.defaults).toMatchObject({ custom: { drawStyle: 'line' } });
        expect(within(getDrawStyleField()).getByRole('combobox', { name: 'Variable for Style' })).toHaveValue('other');
        expect(
          within(getDrawStyleField()).getByText('Allowed values: line, bars, points. Falls back to: Lines')
        ).toBeInTheDocument();

        await userEvent.click(within(getDrawStyleField()).getByRole('button', { name: 'Use variable' }));

        expect(panel.state.fieldConfig.defaults.varMappings).toBeUndefined();
        expect(panel.state.fieldConfig.defaults).toMatchObject({ custom: { drawStyle: 'line' } });
        expect(within(getDrawStyleField()).getByRole('radio', { name: 'Lines' })).toBeChecked();
      });

      it('creates a custom variable for draw style in the dashboard and maps it', async () => {
        const panel = new VizPanel({
          key: 'panel-1',
          pluginId: 'timeseries',
          fieldConfig: { defaults: { custom: { drawStyle: 'bars' } }, overrides: [] },
        });
        const dashboard = placeInDashboard(panel, 'v2')!;
        const getDashboard = jest.spyOn(utils, 'getDashboardSceneFor').mockReturnValue(dashboard);
        await setup({ panel });

        await userEvent.click(within(getDrawStyleField()).getByRole('button', { name: 'Use variable' }));
        await userEvent.click(await screen.findByRole('option', { name: /New variable with these values/ }));

        const created = sceneGraph.lookupVariable('drawStyle', panel);
        expect(created).toBeInstanceOf(CustomVariable);
        expect(created?.state).toMatchObject({ query: 'Lines : line,Bars : bars,Points : points', value: 'bars' });
        expect(panel.state.fieldConfig.defaults.varMappings).toEqual({ 'custom.drawStyle': '${drawStyle}' });
        expect(within(getDrawStyleField()).getByRole('combobox', { name: 'Variable for Style' })).toHaveValue(
          'drawStyle'
        );

        getDashboard.mockReturnValue(new DashboardScene({}));
      });

      it('writes and clears varMappings.custom.drawStyle in an override row', async () => {
        const { panel } = await setupTimeseries({
          defaults: { custom: { drawStyle: 'line' } },
          overrides: [
            {
              matcher: { id: 'byName', options: 'SeriesA' },
              properties: [{ id: 'custom.drawStyle', value: 'bars' }],
            },
          ],
        });
        const properties = () => panel.state.fieldConfig.overrides[0].properties;

        await userEvent.click(within(getOverrideGroup()).getByRole('button', { name: 'Use variable' }));
        await userEvent.click(await screen.findByRole('option', { name: 't' }));

        expect(properties()).toEqual([
          { id: 'custom.drawStyle', value: 'bars' },
          { id: 'varMappings.custom.drawStyle', value: '${t}' },
        ]);
        expect(within(getOverrideGroup()).getByRole('combobox', { name: 'Variable for Style' })).toHaveValue('t');

        await userEvent.click(within(getOverrideGroup()).getByRole('button', { name: 'Use variable' }));

        expect(properties()).toEqual([{ id: 'custom.drawStyle', value: 'bars' }]);
        expect(within(getOverrideGroup()).getByRole('radio', { name: 'Bars' })).toBeChecked();
      });

      it('writes a switch expression and drops it with the override property', async () => {
        const { panel } = await setupTimeseries({
          defaults: { custom: {} },
          overrides: [
            {
              matcher: { id: 'byName', options: 'SeriesA' },
              properties: [{ id: 'custom.axisBorderShow', value: true }],
            },
          ],
        });
        const properties = () => panel.state.fieldConfig.overrides[0].properties;

        await userEvent.click(within(getOverrideGroup()).getByRole('button', { name: 'Use variable' }));
        await userEvent.click(await screen.findByRole('option', { name: 't' }));

        expect(properties()).toEqual([
          { id: 'custom.axisBorderShow', value: true },
          { id: 'varMappings.custom.axisBorderShow', value: '${t}' },
        ]);

        await userEvent.click(within(getOverrideGroup()).getByRole('button', { name: 'Remove property' }));

        expect(properties()).toEqual([]);
      });

      it('keeps the line width slider, writes varMappings.custom.lineWidth and restores the slider with the toggle', async () => {
        const { panel } = await setupTimeseries({ defaults: { custom: { lineWidth: 2 } }, overrides: [] });
        const getLineWidthField = () => screen.getByTestId(OptionsPaneSelector.fieldLabel('Graph styles Line width'));

        expect(within(getLineWidthField()).getByRole('slider')).toBeInTheDocument();

        await userEvent.click(within(getLineWidthField()).getByRole('button', { name: 'Use variable' }));
        await userEvent.click(await screen.findByRole('option', { name: 't' }));

        expect(panel.state.fieldConfig.defaults.varMappings).toEqual({ 'custom.lineWidth': '${t}' });
        expect(panel.state.fieldConfig.defaults).toMatchObject({ custom: { lineWidth: 2 } });
        expect(within(getLineWidthField()).getByText('Falls back to: 2')).toBeInTheDocument();

        await userEvent.click(within(getLineWidthField()).getByRole('button', { name: 'Use variable' }));

        expect(panel.state.fieldConfig.defaults.varMappings).toBeUndefined();
        expect(within(getLineWidthField()).getByRole('slider')).toBeInTheDocument();
      });

      it('keeps a line width slider in an override row', async () => {
        const { panel } = await setupTimeseries({
          defaults: { custom: {} },
          overrides: [
            {
              matcher: { id: 'byName', options: 'SeriesA' },
              properties: [{ id: 'custom.lineWidth', value: 3 }],
            },
          ],
        });

        expect(within(getOverrideGroup()).getByRole('slider')).toBeInTheDocument();

        await userEvent.click(within(getOverrideGroup()).getByRole('button', { name: 'Use variable' }));
        await userEvent.click(await screen.findByRole('option', { name: 't' }));

        expect(panel.state.fieldConfig.overrides[0].properties).toEqual([
          { id: 'custom.lineWidth', value: 3 },
          { id: 'varMappings.custom.lineWidth', value: '${t}' },
        ]);
      });
    });

    it('shows the plain line width slider with the flag off', async () => {
      await setupTimeseries({ defaults: { custom: { lineWidth: 2 } }, overrides: [] });
      const lineWidthField = screen.getByTestId(OptionsPaneSelector.fieldLabel('Graph styles Line width'));

      expect(within(lineWidthField).getByRole('slider')).toBeInTheDocument();
      expect(within(lineWidthField).queryByRole('button', { name: 'Use variable' })).not.toBeInTheDocument();
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
