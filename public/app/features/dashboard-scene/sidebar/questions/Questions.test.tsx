import { type DropResult } from '@hello-pangea/dnd';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type JSX } from 'react';
import { of } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';

import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils, usePluginComponents } from '@grafana/runtime';
import { setGetObservablePluginLinks } from '@grafana/runtime/internal';
import { SceneDataNode, SceneGridLayout, SceneGridRow, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';
import { ShowConfirmModalEvent } from 'app/types/events';

import { type SceneQuestion } from '../../questions/types';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';
import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardEditableElement } from '../dashboard/DashboardEditableElement';
import { SidebarCategoryType } from '../types';

import {
  openAddQuestionPane,
  openEditQuestionPane,
  QuestionTitleInput,
  QuestionEdit,
  QuestionPlacementSwitch,
  QuestionSourcesField,
  QuestionTextInput,
} from './QuestionEdit';
import { QuestionsList } from './QuestionsList';

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneUtils: {
    ...jest.requireActual('@grafana/scenes').sceneUtils,
    registerVariableMacro: jest.fn(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponents: jest.fn(),
}));

// jsdom has no layout to drag between lists with, so this keeps what the lists do on a drop, to be handed one.
let mockOnDragEnd: ((result: DropResult) => void) | undefined;
jest.mock('@hello-pangea/dnd', () => {
  const actual = jest.requireActual('@hello-pangea/dnd');
  const { createElement } = jest.requireActual('react');
  return {
    ...actual,
    DragDropContext: (props: { onDragEnd: (result: DropResult) => void }) => {
      mockOnDragEnd = props.onDragEnd;
      return createElement(actual.DragDropContext, props);
    },
  };
});

jest.mock('app/core/hooks/useQueryParams', () => ({
  useQueryParams: () => [{}, () => {}],
}));

// The picker's fixtures hold real panels, which load their plugin when activated.
setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});
setGetObservablePluginLinks(() => of([]));

const PluginControl = createComponentWithMeta<JSX.IntrinsicAttributes>(
  { pluginId: 'grafana-assistant-app', title: 'Ask Assistant', component: () => null },
  'grafana/dashboard/controls/v1'
);

describe('questions in the dashboard options', () => {
  beforeEach(() => {
    jest.mocked(usePluginComponents).mockReturnValue({ components: [PluginControl], isLoading: false });
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('come right after Links', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const dashboard = v2Dashboard();

    const { result } = renderHook(() => new DashboardEditableElement(dashboard).useSidebarOptions(), {
      wrapper: TestProvider,
    });

    const ids = result.current.map((category) => category.props.id);
    expect(ids.indexOf(SidebarCategoryType.DashboardQuestions)).toBe(
      ids.indexOf(SidebarCategoryType.DashboardLinks) + 1
    );
  });

  it('are not offered while grafana.dashboardQuestions is off', () => {
    setTestFlags({ 'grafana.dashboardQuestions': false });
    const dashboard = v2Dashboard();

    const { result } = renderHook(() => new DashboardEditableElement(dashboard).useSidebarOptions(), {
      wrapper: TestProvider,
    });

    expect(result.current.map((category) => category.props.id)).not.toContain(SidebarCategoryType.DashboardQuestions);
  });

  // A v1 save drops the questions, and turns rows into v1 rows.
  it('are offered on a row only when the dashboard saves as v2', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const rowCategoryIds = (serializerVersion: 'v1' | 'v2') => {
      const row = new RowItem({ title: 'Errors', layout: DefaultGridLayoutManager.createEmpty() });
      new DashboardScene(
        { $data: new DashboardDataLayerSet({}), body: new RowsLayoutManager({ rows: [row] }) },
        serializerVersion
      );
      const { result } = renderHook(() => row.useSidebarOptions(false), { wrapper: TestProvider });
      return result.current.map((category) => category.props.id);
    };

    expect(rowCategoryIds('v2')).toContain(SidebarCategoryType.RowQuestions);
    expect(rowCategoryIds('v1')).not.toContain(SidebarCategoryType.RowQuestions);
  });
});

describe('editing questions', () => {
  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
    jest.restoreAllMocks();
  });

  it('lists the questions and opens the one picked for editing', async () => {
    const dashboard = setup([{ text: 'What stands out?' }, { text: 'Why did errors rise?' }]);
    renderList(dashboard);

    expect(screen.getAllByTestId('question-text').map((item) => item.textContent)).toEqual([
      'What stands out?',
      'Why did errors rise?',
    ]);

    await userEvent.hover(screen.getByText('Why did errors rise?'));
    await userEvent.click(
      screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.List.ListItem.editButton('1'))
    );

    const selected = dashboard.state.sidebar.getSelectedObject();
    expect(selected).toBeInstanceOf(QuestionEdit);
    expect(selected instanceof QuestionEdit && selected.state.questionIndex).toBe(1);
  });

  it('adds an empty question and opens it, and undo removes it', () => {
    const saved = { text: 'What stands out?' };
    const dashboard = setup([saved]);

    act(() => openAddQuestionPane(dashboard, 'dashboard'));

    expect(dashboard.state.questions).toEqual([saved, { text: '' }]);
    const selected = dashboard.state.sidebar.getSelectedObject();
    expect(selected instanceof QuestionEdit && selected.state.questionIndex).toBe(1);

    act(() => dashboard.state.sidebar.undoAction());

    expect(dashboard.state.questions).toEqual([saved]);
  });

  it('saves an edited question as one undo step when the field loses focus', async () => {
    const dashboard = setup([{ text: 'What stands out?' }]);
    render(
      <TestProvider>
        <QuestionTextInput questionEdit={editFor(dashboard, 0)} />
      </TestProvider>
    );
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'Why did errors rise?');
    fireEvent.blur(input);

    expect(dashboard.state.questions).toEqual([{ text: 'Why did errors rise?' }]);
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);

    act(() => dashboard.state.sidebar.undoAction());

    expect(dashboard.state.questions).toEqual([{ text: 'What stands out?' }]);
    expect(input).toHaveValue('What stands out?');
  });

  it('saves a title as one undo step, and leaves it out once cleared', async () => {
    const text = 'Which services drove the rise in errors, and when did it start?';
    const dashboard = setup([{ text }]);
    render(
      <TestProvider>
        <QuestionTitleInput questionEdit={editFor(dashboard, 0)} />
      </TestProvider>
    );
    const input = screen.getByRole('textbox', { name: /^Title/ });

    fireEvent.focus(input);
    await userEvent.type(input, 'Errors');
    fireEvent.blur(input);

    expect(dashboard.state.questions).toEqual([{ text, title: 'Errors' }]);
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);

    fireEvent.focus(input);
    await userEvent.clear(input);
    fireEvent.blur(input);

    expect(dashboard.state.questions).toEqual([{ text }]);

    act(() => dashboard.state.sidebar.undoAction());

    expect(dashboard.state.questions).toEqual([{ text, title: 'Errors' }]);
  });

  it('deletes a question once the author confirms, and undo brings it back', async () => {
    const questions = [{ text: 'What stands out?' }, { text: 'Why did errors rise?' }];
    const dashboard = setup(questions);
    const publish = jest.spyOn(appEvents, 'publish');
    renderList(dashboard);

    await userEvent.click(
      screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.List.ListItem.deleteButton('0'))
    );
    const confirm = publish.mock.calls.map(([event]) => event).find((event) => event instanceof ShowConfirmModalEvent);
    act(() => confirm?.payload.onConfirm?.());

    expect(dashboard.state.questions).toEqual([{ text: 'Why did errors rise?' }]);

    act(() => dashboard.state.sidebar.undoAction());

    expect(dashboard.state.questions).toEqual(questions);
  });

  // The list sits in the dashboard's options, so the options must stay open for the author to keep working in them.
  it('keeps the dashboard options open when a question is deleted from the list', async () => {
    const dashboard = setup([{ text: 'What stands out?' }, { text: 'Why did errors rise?' }]);
    const { sidebar } = dashboard.state;
    act(() => sidebar.openElementSettings(dashboard));
    const publish = jest.spyOn(appEvents, 'publish');
    renderList(dashboard);

    await userEvent.click(
      screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.List.ListItem.deleteButton('0'))
    );
    const confirm = publish.mock.calls.map(([event]) => event).find((event) => event instanceof ShowConfirmModalEvent);
    act(() => confirm?.payload.onConfirm?.());

    expect(dashboard.state.questions).toEqual([{ text: 'Why did errors rise?' }]);
    expect(sidebar.state.openPane?.getId()).toBe('element');
    expect(sidebar.getSelectedObject()).toBe(dashboard);
  });

  it('returns to the dashboard options when the question open in the sidebar is deleted', () => {
    const dashboard = setup([{ text: 'What stands out?' }, { text: 'Why did errors rise?' }]);
    const { sidebar } = dashboard.state;
    act(() => openEditQuestionPane(dashboard, 'dashboard', 1));
    const open = sidebar.getSelectedObject();
    expect(open).toBeInstanceOf(QuestionEdit);

    act(() => open instanceof QuestionEdit && open.onDelete());

    expect(dashboard.state.questions).toEqual([{ text: 'What stands out?' }]);
    expect(sidebar.state.openPane?.getId()).toBe('element');
    expect(sidebar.getSelectedObject()).toBe(dashboard);
  });

  it('duplicates a question at the end of the list', async () => {
    const dashboard = setup([{ text: 'What stands out?' }]);
    renderList(dashboard);

    await userEvent.click(
      screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.List.ListItem.duplicateButton('0'))
    );

    expect(dashboard.state.questions).toEqual([{ text: 'What stands out?' }, { text: 'What stands out? - Copy' }]);
  });

  it('lists a question by its title, and names its copy by its title, keeping the question run', async () => {
    const original = { text: 'Which services drove the rise in errors?', title: 'Errors' };
    const dashboard = setup([original]);
    renderList(dashboard);

    await userEvent.click(
      screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.List.ListItem.duplicateButton('0'))
    );

    expect(dashboard.state.questions).toEqual([original, { ...original, title: 'Errors - Copy' }]);
    expect(screen.getAllByTestId('question-text').map((item) => item.textContent)).toEqual(['Errors', 'Errors - Copy']);
  });
});

describe('placing questions in the controls menu', () => {
  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  const DASHBOARD_LIST = 'dashboard-questions-list';
  const MENU_LIST = 'dashboard-questions-list-controls-menu';
  const labelsIn = (listTestId: string) =>
    within(screen.getByTestId(listTestId))
      .queryAllByTestId('question-text')
      .map((item) => item.textContent);

  it('lists the questions in the menu apart from the ones above the dashboard', () => {
    const dashboard = setup([
      { text: 'What stands out?' },
      { text: 'Why did errors rise?', placement: 'inControlsMenu' },
      { text: 'What changed since yesterday?' },
    ]);
    renderList(dashboard);

    expect(labelsIn(DASHBOARD_LIST)).toEqual(['What stands out?', 'What changed since yesterday?']);
    expect(labelsIn(MENU_LIST)).toEqual(['Why did errors rise?']);
  });

  it('edits a question in the menu by its place in the saved list', async () => {
    const dashboard = setup([
      { text: 'What stands out?' },
      { text: 'Why did errors rise?', placement: 'inControlsMenu' },
    ]);
    renderList(dashboard);

    await userEvent.click(
      screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.List.ListItem.editButton('1'))
    );

    const selected = dashboard.state.sidebar.getSelectedObject();
    expect(selected instanceof QuestionEdit && selected.state.questionIndex).toBe(1);
  });

  // A row or tab has no controls menu, so there is nothing to place a question in.
  it('keeps the questions of a row in one list, whatever their placement', () => {
    const row = new RowItem({
      title: 'Errors',
      layout: DefaultGridLayoutManager.createEmpty(),
      questions: [{ text: 'What stands out?' }, { text: 'Why did errors rise?', placement: 'inControlsMenu' }],
    });
    render(
      <TestProvider>
        <QuestionsList owner={row} ownerKind="row" />
      </TestProvider>
    );

    expect(labelsIn('dash-row-questions-list')).toEqual(['What stands out?', 'Why did errors rise?']);
    expect(screen.queryByTestId(MENU_LIST)).not.toBeInTheDocument();
  });

  it('shows a question in the menu from its switch, and undo puts it back above the dashboard', async () => {
    const dashboard = setup([{ text: 'What stands out?' }]);
    render(
      <TestProvider>
        <QuestionPlacementSwitch questionEdit={editFor(dashboard, 0)} />
      </TestProvider>
    );
    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    expect(dashboard.state.questions).toEqual([{ text: 'What stands out?', placement: 'inControlsMenu' }]);
    expect(toggle).toBeChecked();

    act(() => dashboard.state.sidebar.undoAction());

    expect(dashboard.state.questions).toEqual([{ text: 'What stands out?' }]);
    expect(toggle).not.toBeChecked();
  });

  it('leaves the placement out of a question that is moved back above the dashboard', async () => {
    const dashboard = setup([{ text: 'What stands out?', placement: 'inControlsMenu' }]);
    render(
      <TestProvider>
        <QuestionPlacementSwitch questionEdit={editFor(dashboard, 0)} />
      </TestProvider>
    );

    await userEvent.click(screen.getByRole('switch'));

    expect(dashboard.state.questions).toEqual([{ text: 'What stands out?' }]);
    expect(dashboard.state.questions?.[0]).not.toHaveProperty('placement');
  });

  it.each<['dashboard' | 'row' | 'tab', boolean]>([
    ['dashboard', true],
    ['row', false],
    ['tab', false],
  ])('offers the switch for a question on a %s: %s', (ownerKind, offered) => {
    const dashboard = setup([{ text: 'What stands out?' }]);
    const edit = new QuestionEdit({ ownerRef: dashboard.getRef(), ownerKind, questionIndex: 0 });

    const { result } = renderHook(() => edit.useSidebarOptions(false), { wrapper: TestProvider });

    const titles = result.current.flatMap((category) => category.items.map((item) => item.props.title));
    expect(titles.includes('Show in controls menu')).toBe(offered);
  });

  describe('dragging', () => {
    // @hello-pangea/dnd announces each phase through an aria-live region, which tells when it has processed a key.
    async function dragWithKeyboard(key: string, keyCodes: number[]) {
      const selector = `[data-rfd-drag-handle-draggable-id="${key}"]`;
      // The library loads once the list has rendered.
      await waitFor(() => expect(document.querySelector(selector)).toBeInTheDocument());
      const handle = document.querySelector<HTMLElement>(selector)!;
      handle.focus();
      fireEvent.keyDown(handle, { keyCode: 32 });
      await screen.findByText(/you have lifted an item/i);
      for (const keyCode of keyCodes) {
        fireEvent.keyDown(handle, { keyCode });
        await screen.findByText(/you have moved the item/i);
      }
      fireEvent.keyDown(handle, { keyCode: 32 });
      await screen.findByText(/you have dropped the item/i);
    }

    function drop(from: { droppableId: string; index: number }, to: { droppableId: string; index: number }) {
      act(() =>
        mockOnDragEnd?.({
          draggableId: 'question',
          type: 'DEFAULT',
          source: from,
          destination: to,
          reason: 'DROP',
          mode: 'FLUID',
          combine: null,
        })
      );
    }

    it('reorders the questions above the dashboard as one undoable step', async () => {
      const dashboard = setup([
        { text: 'What stands out?' },
        { text: 'Why did errors rise?', placement: 'inControlsMenu' },
        { text: 'What changed since yesterday?' },
      ]);
      renderList(dashboard);

      await dragWithKeyboard('0', [40]);

      await waitFor(() =>
        expect(labelsIn(DASHBOARD_LIST)).toEqual(['What changed since yesterday?', 'What stands out?'])
      );
      expect(dashboard.state.questions).toEqual([
        { text: 'What changed since yesterday?' },
        { text: 'What stands out?' },
        { text: 'Why did errors rise?', placement: 'inControlsMenu' },
      ]);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);

      act(() => dashboard.state.sidebar.undoAction());

      expect(labelsIn(DASHBOARD_LIST)).toEqual(['What stands out?', 'What changed since yesterday?']);
    });

    it('places a question in the menu where it is dropped there, as one undoable step', async () => {
      const saved: SceneQuestion[] = [
        { text: 'What stands out?' },
        { text: 'Why did errors rise?' },
        { text: 'What changed since yesterday?', placement: 'inControlsMenu' },
      ];
      const dashboard = setup(saved);
      renderList(dashboard);

      // The first question, dropped ahead of the one already in the menu.
      drop({ droppableId: DASHBOARD_LIST, index: 0 }, { droppableId: MENU_LIST, index: 0 });

      expect(dashboard.state.questions).toEqual([
        { text: 'Why did errors rise?' },
        { text: 'What stands out?', placement: 'inControlsMenu' },
        { text: 'What changed since yesterday?', placement: 'inControlsMenu' },
      ]);
      expect(labelsIn(MENU_LIST)).toEqual(['What stands out?', 'What changed since yesterday?']);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);

      act(() => dashboard.state.sidebar.undoAction());

      expect(dashboard.state.questions).toEqual(saved);
    });

    it('clears the placement of a question dropped back above the dashboard', () => {
      const dashboard = setup([
        { text: 'What stands out?' },
        { text: 'Why did errors rise?', placement: 'inControlsMenu' },
      ]);
      renderList(dashboard);

      drop({ droppableId: MENU_LIST, index: 0 }, { droppableId: DASHBOARD_LIST, index: 0 });

      expect(dashboard.state.questions).toEqual([{ text: 'Why did errors rise?' }, { text: 'What stands out?' }]);
      expect(dashboard.state.questions?.[0]).not.toHaveProperty('placement');
    });

    it('changes nothing when a question is dropped where it was', () => {
      const dashboard = setup([{ text: 'What stands out?' }]);
      renderList(dashboard);

      drop({ droppableId: DASHBOARD_LIST, index: 0 }, { droppableId: DASHBOARD_LIST, index: 0 });

      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
    });

    it('reorders the questions of a row without placing any in a menu', () => {
      const row = new RowItem({
        title: 'Errors',
        layout: DefaultGridLayoutManager.createEmpty(),
        questions: [{ text: 'What stands out?' }, { text: 'Why did errors rise?', placement: 'inControlsMenu' }],
      });
      // The dashboard's sidebar performs the edit once it is active.
      activateFullSceneTree(
        new DashboardScene({ isEditing: true, body: new RowsLayoutManager({ rows: [row] }) }, 'v2')
      );
      render(
        <TestProvider>
          <QuestionsList owner={row} ownerKind="row" />
        </TestProvider>
      );

      drop({ droppableId: 'dash-row-questions-list', index: 1 }, { droppableId: 'dash-row-questions-list', index: 0 });

      // Neither the one moved nor the other gets a placement it didn't have, or loses the one it saved.
      expect(row.state.questions).toEqual([
        { text: 'Why did errors rise?', placement: 'inControlsMenu' },
        { text: 'What stands out?' },
      ]);
    });
  });
});

describe('picking the panels a question is answered from', () => {
  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  // Async, so the panels' activation finishes before the test looks at the picker.
  async function renderSources(dashboard: DashboardScene) {
    await act(async () => {
      render(
        <TestProvider>
          <QuestionSourcesField questionEdit={editFor(dashboard, 0)} />
        </TestProvider>
      );
    });
  }

  it('starts with nothing picked, so the question is answered from every panel on the dashboard', async () => {
    const dashboard = setupWithPanels([{ text: 'Why did errors rise?' }]);
    await renderSources(dashboard);

    expect(screen.getByRole('checkbox', { name: /^Entire dashboard/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Entire dashboard/ })).not.toBePartiallyChecked();
    expect(
      screen.getByText('With none picked, the question is answered from every panel on this dashboard.')
    ).toBeInTheDocument();
  });

  it('lists panels under the rows they sit in, and saves each pick as one undo step', async () => {
    const dashboard = setupWithPanels([{ text: 'Why did errors rise?' }]);
    await renderSources(dashboard);

    // A row starts collapsed while none of its panels is picked.
    expect(screen.queryByRole('checkbox', { name: 'Error rate' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Errors' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Error rate' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Requests' }));

    expect(dashboard.state.questions).toEqual([
      { text: 'Why did errors rise?', sources: [{ panelId: 3 }, { panelId: 1 }] },
    ]);
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(2);

    act(() => dashboard.state.sidebar.undoAction());
    act(() => dashboard.state.sidebar.undoAction());

    expect(dashboard.state.questions).toEqual([{ text: 'Why did errors rise?' }]);
  });

  it('picks every panel in a row at once, and shows the dashboard as partly picked', async () => {
    const dashboard = setupWithPanels([{ text: 'Why did errors rise?' }]);
    await renderSources(dashboard);

    await userEvent.click(screen.getByRole('checkbox', { name: /^Errors/ }));

    expect(dashboard.state.questions).toEqual([{ text: 'Why did errors rise?', sources: [{ panelId: 3 }] }]);
    expect(screen.getByRole('checkbox', { name: /^Errors/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Entire dashboard/ })).toBePartiallyChecked();
    expect(screen.getByText('1 panel picked')).toBeInTheDocument();
  });

  it('opens the rows that hold a picked panel', async () => {
    const dashboard = setupWithPanels([{ text: 'Why did errors rise?', sources: [{ panelId: 3 }] }]);
    await renderSources(dashboard);

    expect(screen.getByRole('checkbox', { name: 'Error rate' })).toBeChecked();
  });

  it('leaves the sources out once every panel is unpicked', async () => {
    const dashboard = setupWithPanels([{ text: 'Why did errors rise?', sources: [{ panelId: 1 }] }]);
    await renderSources(dashboard);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Requests' }));

    expect(dashboard.state.questions).toEqual([{ text: 'Why did errors rise?' }]);
  });

  it('keeps a picked panel that is no longer on the dashboard until the author unpicks it', async () => {
    const dashboard = setupWithPanels([{ text: 'Why did errors rise?', sources: [{ panelId: 9 }] }]);
    await renderSources(dashboard);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Requests' }));
    expect(dashboard.state.questions).toEqual([
      { text: 'Why did errors rise?', sources: [{ panelId: 9 }, { panelId: 1 }] },
    ]);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Panel 9 (unavailable)' }));
    expect(dashboard.state.questions).toEqual([{ text: 'Why did errors rise?', sources: [{ panelId: 1 }] }]);
  });
});

function setup(questions: SceneQuestion[]) {
  const dashboard = transformSaveModelToScene({
    dashboard: { title: 'Dashboard', uid: 'my-uid', schemaVersion: 30, panels: [], version: 10 },
    meta: {},
  });
  dashboard.setState({ $data: undefined, questions });

  setTestFlags({ dashboardNewLayouts: true });
  activateFullSceneTree(dashboard);
  dashboard.onEnterEditMode();

  return dashboard;
}

function v2Dashboard() {
  return new DashboardScene(
    {
      $data: new DashboardDataLayerSet({}),
      body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
    },
    'v2'
  );
}

/** A "Requests" panel on the dashboard, and an "Errors" row holding an "Error rate" panel. */
function setupWithPanels(questions: SceneQuestion[]) {
  const panel = (id: number, title: string) =>
    new DashboardGridItem({
      body: new VizPanel({
        key: `panel-${id}`,
        title,
        pluginId: 'timeseries',
        $data: new SceneDataNode({ data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() } }),
      }),
    });

  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    isEditing: true,
    questions,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [panel(1, 'Requests'), new SceneGridRow({ title: 'Errors', children: [panel(3, 'Error rate')] })],
      }),
    }),
  });
  activateFullSceneTree(dashboard);
  return dashboard;
}

function renderList(dashboard: DashboardScene) {
  return render(
    <TestProvider>
      <QuestionsList owner={dashboard} ownerKind="dashboard" />
    </TestProvider>
  );
}

function editFor(dashboard: DashboardScene, questionIndex: number) {
  return new QuestionEdit({ ownerRef: dashboard.getRef(), ownerKind: 'dashboard', questionIndex });
}
