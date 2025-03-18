import { VariableRefresh } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneVariableSet, TestVariable, VizPanel } from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { activateFullSceneTree, buildPanelRepeaterScene } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';

import { DashboardGridItem, DashboardGridItemState } from './DashboardGridItem';
import { DefaultGridLayoutManager } from './DefaultGridLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginLinkExtensions: jest.fn().mockReturnValue({ extensions: [] }),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

const mockGetQueryRunnerFor = jest.fn();
jest.mock('../../utils/utils', () => ({
  ...jest.requireActual('../../utils/utils'),
  getQueryRunnerFor: jest.fn().mockImplementation(() => mockGetQueryRunnerFor()),
}));

describe('PanelRepeaterGridItem', () => {
  it('Given scene with variable with 2 values', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 0 });

    activateFullSceneTree(scene);

    expect(repeater.state.repeatedPanels?.length).toBe(5);

    const panel1 = repeater.state.repeatedPanels![0];
    const panel2 = repeater.state.repeatedPanels![1];

    // Panels should have scoped variables
    expect(panel1.state.$variables?.state.variables[0].getValue()).toBe('1');
    expect(panel1.state.$variables?.state.variables[0].getValueText?.()).toBe('A');
    expect(panel2.state.$variables?.state.variables[0].getValue()).toBe('2');
  });

  it('Should wait for variable to load', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 1 });

    activateFullSceneTree(scene);

    expect(repeater.state.repeatedPanels?.length).toBe(0);

    await new Promise((r) => setTimeout(r, 10));

    expect(repeater.state.repeatedPanels?.length).toBe(5);
  });

  it('Should update panels on refresh if variables load on time range change', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({
      variableQueryTime: 0,
      variableRefresh: VariableRefresh.onTimeRangeChanged,
    });

    const notifyPanelsSpy = jest.spyOn(repeater, 'notifyRepeatedPanelsWaitingForVariables');

    activateFullSceneTree(scene);

    expect(repeater.state.repeatedPanels?.length).toBe(5);

    expect(notifyPanelsSpy).toHaveBeenCalledTimes(0);

    scene.state.$timeRange?.onRefresh();

    //make sure notifier is called
    expect(notifyPanelsSpy).toHaveBeenCalledTimes(1);

    //make sure getQueryRunner is called for each repeated panel
    expect(mockGetQueryRunnerFor).toHaveBeenCalledTimes(5);

    notifyPanelsSpy.mockRestore();
    mockGetQueryRunnerFor.mockClear();
  });

  it('Should display a panel when there are no options', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 1, numberOfOptions: 0 });

    activateFullSceneTree(scene);

    expect(repeater.state.repeatedPanels?.length).toBe(0);

    await new Promise((r) => setTimeout(r, 100));

    expect(repeater.state.repeatedPanels?.length).toBe(1);
  });

  it('Should redo the repeat when editing panel and then returning to dashboard', async () => {
    const panel = new DashboardGridItem({
      variableName: 'server',
      repeatedPanels: [],
      body: new VizPanel({
        title: 'Panel $server',
      }),
    });

    const variable = new TestVariable({
      name: 'server',
      query: 'A.*',
      value: ALL_VARIABLE_VALUE,
      text: ALL_VARIABLE_TEXT,
      isMulti: true,
      includeAll: true,
      delayMs: 0,
      optionsToReturn: [
        { label: 'A', value: '1' },
        { label: 'B', value: '2' },
        { label: 'C', value: '3' },
        { label: 'D', value: '4' },
        { label: 'E', value: '5' },
      ],
    });

    const scene = new DashboardScene({
      $variables: new SceneVariableSet({
        variables: [variable],
      }),
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [panel] }),
      }),
    });

    const deactivate = activateFullSceneTree(scene);

    await new Promise((r) => setTimeout(r, 10));

    expect(panel.state.repeatedPanels?.length).toBe(5);

    const vizPanel = panel.state.body as VizPanel;

    expect(vizPanel.state.title).toBe('Panel $server');

    // mimic going to panel edit
    deactivate();

    await new Promise((r) => setTimeout(r, 10));

    vizPanel.setState({ title: 'Changed' });

    panel.editingCompleted(true);

    // mimic returning to dashboard
    activateFullSceneTree(scene);

    await new Promise((r) => setTimeout(r, 10));

    expect(panel.state.repeatedPanels?.length).toBe(5);
    expect((panel.state.repeatedPanels![0] as VizPanel).state.title).toBe('Changed');
  });

  it('Should only redo the repeat of an edited panel, not all panels in dashboard', async () => {
    const panel = new DashboardGridItem({
      variableName: 'server',
      repeatedPanels: [],
      body: new VizPanel({
        title: 'Panel $server',
      }),
    });

    const panel2 = new DashboardGridItem({
      variableName: 'server',
      repeatedPanels: [],
      body: new VizPanel({
        title: 'Panel $server 2',
      }),
    });

    const variable = new TestVariable({
      name: 'server',
      query: 'A.*',
      value: ALL_VARIABLE_VALUE,
      text: ALL_VARIABLE_TEXT,
      isMulti: true,
      includeAll: true,
      delayMs: 0,
      optionsToReturn: [
        { label: 'A', value: '1' },
        { label: 'B', value: '2' },
        { label: 'C', value: '3' },
        { label: 'D', value: '4' },
        { label: 'E', value: '5' },
      ],
    });

    const scene = new DashboardScene({
      $variables: new SceneVariableSet({
        variables: [variable],
      }),
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [panel, panel2],
        }),
      }),
    });

    const deactivate = activateFullSceneTree(scene);

    await new Promise((r) => setTimeout(r, 10));

    expect(panel.state.repeatedPanels?.length).toBe(5);

    const vizPanel = panel.state.body as VizPanel;

    expect(vizPanel.state.title).toBe('Panel $server');

    // mimic going to panel edit
    deactivate();

    await new Promise((r) => setTimeout(r, 10));

    vizPanel.setState({ title: 'Changed' });

    panel.editingCompleted(true);

    const performRepeatMock = jest.spyOn(panel, 'performRepeat');

    // mimic returning to dashboard
    activateFullSceneTree(scene);

    await new Promise((r) => setTimeout(r, 10));

    expect(performRepeatMock).toHaveBeenCalledTimes(1); // only for the edited panel
    expect(panel.state.repeatedPanels?.length).toBe(5);
    expect((panel.state.repeatedPanels![0] as VizPanel).state.title).toBe('Changed');
  });

  it('Should display a panel when there are variable errors', () => {
    const { scene, repeater } = buildPanelRepeaterScene({
      variableQueryTime: 0,
      numberOfOptions: 0,
      throwError: 'Error',
    });

    // we expect console.error when variable encounters an error
    const origError = console.error;
    console.error = jest.fn();

    activateFullSceneTree(scene);

    expect(repeater.state.repeatedPanels?.length).toBe(1);
    console.error = origError;
  });

  it('Should display a panel when there are variable errors async query', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({
      variableQueryTime: 1,
      numberOfOptions: 0,
      throwError: 'Error',
    });

    // we expect console.error when variable encounters an error
    const origError = console.error;
    console.error = jest.fn();

    activateFullSceneTree(scene);

    await new Promise((r) => setTimeout(r, 10));

    expect(repeater.state.repeatedPanels?.length).toBe(1);
    console.error = origError;
  });

  it('Should adjust container height to fit panels direction is horizontal', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 0, maxPerRow: 2, itemHeight: 10 });

    const layoutForceRender = jest.fn();
    const layout = scene.state.body as DefaultGridLayoutManager;
    layout.state.grid.forceRender = layoutForceRender;

    activateFullSceneTree(scene);

    // panels require 3 rows so total height should be 30
    expect(repeater.state.height).toBe(30);
    // Should update layout state by force re-render
    expect(layoutForceRender.mock.calls.length).toBe(1);
  });

  it('Should adjust container height to fit panels when direction is vertical', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 0, itemHeight: 10, repeatDirection: 'v' });

    activateFullSceneTree(scene);

    // In vertical direction height itemCount * itemHeight
    expect(repeater.state.height).toBe(50);
  });

  it('Should skip repeat when variable values are the same ', async () => {
    const { scene, repeater, variable } = buildPanelRepeaterScene({ variableQueryTime: 0, itemHeight: 10 });
    const stateUpdates: DashboardGridItemState[] = [];
    repeater.subscribeToState((state) => stateUpdates.push(state));

    activateFullSceneTree(scene);

    expect(stateUpdates.length).toBe(1);
    repeater.variableDependency?.variableUpdateCompleted(variable, true);
    expect(stateUpdates.length).toBe(1);
  });

  it('Should adjust itemHeight when container is resized, direction horizontal', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({
      variableQueryTime: 0,
      itemHeight: 10,
      repeatDirection: 'h',
      maxPerRow: 4,
    });

    activateFullSceneTree(scene);

    // Sould be two rows (5 panels and maxPerRow 5)
    expect(repeater.state.height).toBe(20);

    // resize container
    repeater.setState({ height: 10 });
    // given 2 current rows, the itemHeight is halved
    expect(repeater.state.itemHeight).toBe(5);
  });

  it('Should adjust itemHeight when container is resized, direction vertical', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({
      variableQueryTime: 0,
      itemHeight: 10,
      repeatDirection: 'v',
    });

    activateFullSceneTree(scene);

    // In vertical direction height itemCount * itemHeight
    expect(repeater.state.height).toBe(50);

    // resize container
    repeater.setState({ height: 25 });
    // given 5 rows with total height 25 gives new itemHeight of 5
    expect(repeater.state.itemHeight).toBe(5);
  });

  it('Should update repeats when updating variable', async () => {
    const { scene, repeater, variable } = buildPanelRepeaterScene({ variableQueryTime: 0 });

    activateFullSceneTree(scene);

    variable.changeValueTo(['1', '3'], ['A', 'C']);

    expect(repeater.state.repeatedPanels?.length).toBe(2);
  });

  it('Should fall back to default variable if specified variable cannot be found', () => {
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 0 });
    scene.setState({ $variables: undefined });
    activateFullSceneTree(scene);
    expect(repeater.state.repeatedPanels?.[0].state.$variables?.state.variables[0].state.name).toBe(
      '_____default_sys_repeat_var_____'
    );
  });

  it('Should return className when repeat variable is set', () => {
    const { repeater } = buildPanelRepeaterScene({ variableQueryTime: 0 });

    expect(repeater.getClassName()).toBe('panel-repeater-grid-item');
  });

  it('Should not className variable is not set', () => {
    const gridItem = new DashboardGridItem({
      body: new VizPanel({ pluginId: 'text' }),
    });

    expect(gridItem.getClassName()).toBe('');
  });
});
