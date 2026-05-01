import { render, screen } from '@testing-library/react';
import React from 'react';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import {
  CustomVariable,
  LocalValueVariable,
  SceneGridLayout,
  SceneVariableSet,
  ScopesVariable,
  TextBoxVariable,
  VizPanel,
} from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { contextSrv } from 'app/core/services/context_srv';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { KioskMode } from 'app/types/dashboard';

import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardControls, type DashboardControlsState } from './DashboardControls';
import { DashboardScene } from './DashboardScene';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasEditPermissionInFolders: false,
  },
}));

jest.mock('app/features/playlist/PlaylistSrv', () => ({
  playlistSrv: {
    useState: jest.fn().mockReturnValue({ isPlaying: false }),
    state: { isPlaying: false },
    stop: jest.fn(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({ getTagKeysProvider: jest.fn() }),
    getList: jest.fn(),
    getInstanceSettings: jest.fn(),
    reload: jest.fn(),
    registerRuntimeDataSource: jest.fn(),
  })),
}));

function renderInGrafanaContext(child: React.ReactNode, kioskMode?: KioskMode) {
  const context = getGrafanaContextMock();
  if (kioskMode !== undefined) {
    context.chrome.update({ kioskMode: KioskMode.Full });
  }
  return render(<GrafanaContext.Provider value={context}>{child}</GrafanaContext.Provider>);
}

describe('DashboardControls', () => {
  beforeEach(() => {
    setTestFlags({});
  });

  afterEach(() => {
    setTestFlags({});
  });

  describe('Given a standard scene', () => {
    it('should initialize with default values', () => {
      const scene = buildTestScene();
      expect(scene.state.timePicker).toBeDefined();
      expect(scene.state.refreshPicker).toBeDefined();
    });

    describe('.hasControls()', () => {
      it('should return TRUE if any of the controls are available', () => {
        const scene = buildTestScene({
          hideTimeControls: false,
          hideVariableControls: false,
          hideLinksControls: false,
          hideDashboardControls: false,
        });

        // All controls visible
        expect(scene.hasControls()).toBeTruthy();

        // Hiding time controls
        scene.setState({
          hideTimeControls: true,
          hideVariableControls: false,
          hideLinksControls: false,
          hideDashboardControls: false,
        });
        expect(scene.hasControls()).toBeTruthy();

        // Hide variable controls as well
        scene.setState({
          hideTimeControls: true,
          hideVariableControls: true,
          hideLinksControls: false,
          hideDashboardControls: false,
        });
        expect(scene.hasControls()).toBeTruthy();

        // Hide link controls as well
        scene.setState({
          hideTimeControls: true,
          hideVariableControls: true,
          hideLinksControls: true,
          hideDashboardControls: false,
        });
        expect(scene.hasControls()).toBeTruthy();
      });

      it('should return FALSE if no controls are available', () => {
        const scene = buildTestScene({
          hideTimeControls: true,
          hideVariableControls: true,
          hideLinksControls: true,
          hideDashboardControls: true,
        });

        expect(scene.hasControls()).toBeFalsy();
      });
    });
  });

  describe('Component', () => {
    it('should render', () => {
      const scene = buildTestScene();
      expect(() => {
        render(<scene.Component model={scene} />);
      }).not.toThrow();
    });

    it('should render visible controls', async () => {
      const scene = buildTestScene({});
      const renderer = render(<scene.Component model={scene} />);

      expect(await renderer.findByTestId(selectors.pages.Dashboard.Controls)).toBeInTheDocument();
      expect(await renderer.findByTestId(selectors.components.DashboardLinks.container)).toBeInTheDocument();
      expect(await renderer.findByTestId(selectors.components.TimePicker.openButton)).toBeInTheDocument();
      expect(await renderer.findByTestId(selectors.components.RefreshPicker.runButtonV2)).toBeInTheDocument();
      expect(await renderer.findByTestId(selectors.pages.Dashboard.SubMenu.submenuItem)).toBeInTheDocument();
    });

    it('should render with hidden controls', async () => {
      const scene = buildTestScene({
        hideTimeControls: true,
        hideVariableControls: true,
        hideLinksControls: true,
        hideDashboardControls: true,
      });
      const renderer = render(<scene.Component model={scene} />);

      expect(renderer.queryByTestId(selectors.pages.Dashboard.Controls)).not.toBeInTheDocument();
    });

    it('should render ScopesVariable Component even when hidden', () => {
      const scopeVariable = new ScopesVariable({
        enable: true,
      });

      const dashboard = new DashboardScene({
        uid: 'test-dashboard',
        $variables: new SceneVariableSet({
          variables: [scopeVariable],
        }),
        controls: new DashboardControls({
          hideTimeControls: true,
          hideVariableControls: true,
          hideLinksControls: true,
          hideDashboardControls: true,
        }),
      });

      dashboard.activate();

      const controls = dashboard.state.controls as DashboardControls;

      // Mock the Component getter - use 'as any' to bypass TypeScript's getter checking
      // Return a component function (not JSX directly) that renders our test element
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(scopeVariable as any, 'Component', 'get').mockReturnValue(() => {
        return <div>Mocked Component</div>;
      });

      const renderer = render(<controls.Component model={controls} />);

      // Verify UNSAFE_renderAsHidden is set (required for renderHiddenVariables to include it)
      expect(scopeVariable.UNSAFE_renderAsHidden).toBe(true);

      // Check that the mocked component is rendered - this proves renderHiddenVariables
      // accessed the Component getter and rendered it
      expect(renderer.getByText('Mocked Component')).toBeInTheDocument();

      jest.restoreAllMocks();
    });

    it('should show loading skeleton when default controls are loading', () => {
      const scene = buildTestScene();
      const dashboard = getDashboard(scene);
      dashboard.setState({ defaultVariablesLoading: true });

      const { container } = render(<scene.Component model={scene} />);
      expect(container.querySelector('.react-loading-skeleton')).toBeInTheDocument();
    });

    it('should not show loading skeleton when default controls are done loading', () => {
      const scene = buildTestScene();
      const dashboard = getDashboard(scene);
      dashboard.setState({ defaultVariablesLoading: false, defaultLinksLoading: false });

      const { container } = render(<scene.Component model={scene} />);
      expect(container.querySelector('.react-loading-skeleton')).not.toBeInTheDocument();
    });

    it.each([
      {
        title: 'should include only viewed panel ancestor section variables in panel view mode',
        featureFlags: { dashboardSectionVariables: true },
        sceneBuilder: buildPanelViewVariablesScene,
        expectedVisible: ['ancestorVar', 'dashboardVar', 'dupVar'],
        expectedHidden: ['otherSectionVar'],
      },
      {
        title: 'should include only edited panel ancestor section variables in panel edit mode',
        featureFlags: { dashboardSectionVariables: true },
        sceneBuilder: buildPanelEditVariablesScene,
        expectedVisible: ['ancestorVar', 'dashboardVar', 'dupVar'],
        expectedHidden: ['otherSectionVar'],
      },
      {
        title: 'should not include section variables in panel edit mode when section feature is disabled',
        sceneBuilder: buildPanelEditVariablesScene,
        expectedVisible: ['dashboardVar'],
        expectedHidden: ['ancestorVar', 'otherSectionVar'],
      },
      {
        title: 'should hide repeat local section variables in panel edit mode',
        featureFlags: { dashboardSectionVariables: true },
        sceneBuilder: buildPanelEditSceneWithRepeatVariable,
        expectedVisible: ['repeatSource'],
        expectedUnique: ['repeatSource'],
      },
    ])('$title', async ({ featureFlags, sceneBuilder, expectedVisible, expectedHidden, expectedUnique }) => {
      await assertPanelEditVariableVisibility({
        sceneBuilder,
        featureFlags,
        expectedVisible,
        expectedHidden,
        expectedUnique,
      });
    });
  });

  describe('UrlSync', () => {
    it('should return keys', () => {
      const scene = buildTestScene();
      // @ts-expect-error
      expect(scene._urlSync.getKeys()).toEqual([
        '_dash.hideTimePicker',
        '_dash.hideVariables',
        '_dash.hideLinks',
        '_dash.hideDashboardControls',
        '_dash.hidePlaylistNav',
      ]);
    });

    it('should not return url state for hide flags', () => {
      const scene = buildTestScene();
      expect(scene.getUrlState()).toEqual({});
      scene.setState({
        hideTimeControls: true,
        hideVariableControls: true,
        hideLinksControls: true,
        hideDashboardControls: true,
        hidePlaylistNav: true,
      });
      expect(scene.getUrlState()).toEqual({});
    });

    it('should update from url', () => {
      const scene = buildTestScene();
      scene.updateFromUrl({
        '_dash.hideTimePicker': 'true',
        '_dash.hideVariables': 'true',
        '_dash.hideLinks': 'true',
        '_dash.hideDashboardControls': 'true',
        '_dash.hidePlaylistNav': 'true',
      });
      expect(scene.state.hideTimeControls).toBeTruthy();
      expect(scene.state.hideVariableControls).toBeTruthy();
      expect(scene.state.hideLinksControls).toBeTruthy();
      expect(scene.state.hideDashboardControls).toBeTruthy();
      expect(scene.state.hidePlaylistNav).toBeTruthy();
      scene.updateFromUrl({
        '_dash.hideTimePicker': '',
        '_dash.hideVariables': '',
        '_dash.hideLinks': '',
        '_dash.hideDashboardControls': '',
        '_dash.hidePlaylistNav': '',
      });
      expect(scene.state.hideTimeControls).toBeTruthy();
      expect(scene.state.hideVariableControls).toBeTruthy();
      expect(scene.state.hideLinksControls).toBeTruthy();
      expect(scene.state.hideDashboardControls).toBeTruthy();
      expect(scene.state.hidePlaylistNav).toBeTruthy();
    });

    it('should not override state if no new state comes from url', () => {
      const scene = buildTestScene({
        hideTimeControls: true,
        hideVariableControls: true,
        hideLinksControls: true,
        hideDashboardControls: true,
        hidePlaylistNav: true,
      });
      scene.updateFromUrl({});
      expect(scene.state.hideTimeControls).toBeTruthy();
      expect(scene.state.hideVariableControls).toBeTruthy();
      expect(scene.state.hideLinksControls).toBeTruthy();
      expect(scene.state.hideDashboardControls).toBeTruthy();
      expect(scene.state.hidePlaylistNav).toBeTruthy();
    });

    it('should not call setState if no changes', () => {
      const scene = buildTestScene({
        hideTimeControls: true,
        hideVariableControls: true,
        hideLinksControls: true,
        hideDashboardControls: true,
        hidePlaylistNav: true,
      });
      const setState = jest.spyOn(scene, 'setState');

      scene.updateFromUrl({
        '_dash.hideTimePicker': 'true',
        '_dash.hideVariables': 'true',
        '_dash.hideLinks': 'true',
        '_dash.hideDashboardControls': 'true',
        '_dash.hidePlaylistNav': 'true',
      });

      expect(setState).toHaveBeenCalledTimes(0);
    });
  });

  describe('DashboardControlActions editable flag', () => {
    const originalFeatureToggles = { ...config.featureToggles };

    beforeEach(() => {
      config.featureToggles.dashboardNewLayouts = true;
      jest.mocked(playlistSrv.useState).mockReturnValue({ isPlaying: false });
    });

    afterEach(() => {
      config.featureToggles = originalFeatureToggles;
      jest.resetAllMocks();
    });

    it('should show EditDashboardSwitch when editable is true', async () => {
      const controls = buildTestSceneWithEditable({ editable: true, canEdit: true });
      renderInGrafanaContext(<controls.Component model={controls} />, undefined);

      expect(await screen.findByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /make editable/i })).not.toBeInTheDocument();
    });

    it('should show MakeDashboardEditableButton when editable is false', async () => {
      const controls = buildTestSceneWithEditable({ editable: false, canEdit: false, canMakeEditable: true });
      renderInGrafanaContext(<controls.Component model={controls} />, undefined);

      expect(await screen.findByRole('button', { name: /make editable/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    });

    it('should not show edit buttons when canEditDashboard returns false', async () => {
      const controls = buildTestSceneWithEditable({
        editable: true,
        canEdit: false,
        canMakeEditable: false,
        isSnapshot: true,
      });
      renderInGrafanaContext(<controls.Component model={controls} />, undefined);

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /make editable/i })).not.toBeInTheDocument();
    });

    it('should not show edit buttons when playlist is playing', async () => {
      jest.mocked(playlistSrv.useState).mockReturnValue({ isPlaying: true });

      const controls = buildTestSceneWithEditable({ editable: true, canEdit: true });
      renderInGrafanaContext(<controls.Component model={controls} />, undefined);

      expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.prev)).toBeInTheDocument();
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.stop)).toBeInTheDocument();
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.next)).toBeInTheDocument();
    });

    it('should not show EditDashboardSwitch when dashboard has no uid (new dashboard)', async () => {
      const controls = buildTestSceneWithEditable({ hasUid: false, editable: true, canEdit: true });

      renderInGrafanaContext(<controls.Component model={controls} />, undefined);

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('should show playlist nav buttons when hidePlaylistNav is undefined', async () => {
      jest.mocked(playlistSrv.useState).mockReturnValue({ isPlaying: true });

      const controls = buildTestSceneWithEditable({ editable: true, canEdit: true });
      renderInGrafanaContext(<controls.Component model={controls} />, undefined);

      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.prev)).toBeInTheDocument();
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.stop)).toBeInTheDocument();
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.next)).toBeInTheDocument();
    });

    it('should hide playlist nav buttons when hidePlaylistNav is true', async () => {
      jest.mocked(playlistSrv.useState).mockReturnValue({ isPlaying: true });

      const controls = buildTestSceneWithEditable({ editable: true, canEdit: true });
      controls.setState({ hidePlaylistNav: true });
      renderInGrafanaContext(<controls.Component model={controls} />, undefined);

      expect(screen.queryByTestId(selectors.pages.Dashboard.DashNav.playlistControls.prev)).not.toBeInTheDocument();
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.stop)).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.pages.Dashboard.DashNav.playlistControls.next)).not.toBeInTheDocument();
    });
  });

  describe('DashboardControlActions kiosk mode', () => {
    const originalFeatureToggles = { ...config.featureToggles };

    beforeEach(() => {
      jest.mocked(playlistSrv.useState).mockReturnValue({ isPlaying: false });
      config.featureToggles.dashboardNewLayouts = true;
    });

    afterEach(() => {
      config.featureToggles = originalFeatureToggles;
      jest.resetAllMocks();
    });

    it('should hide Edit and Share buttons in kiosk mode', async () => {
      const controls = buildTestSceneWithEditable({ editable: true, canEdit: true });
      renderInGrafanaContext(<controls.Component model={controls} />, KioskMode.Full);

      expect(screen.queryByTestId(selectors.components.NavToolbar.editDashboard.editButton)).not.toBeInTheDocument();
      expect(screen.queryByTestId(selectors.pages.Dashboard.DashNav.newShareButton.container)).not.toBeInTheDocument();
    });

    it('should show Edit and Share buttons when not in kiosk mode', async () => {
      const controls = buildTestSceneWithEditable({ editable: true, canEdit: true });
      renderInGrafanaContext(<controls.Component model={controls} />, undefined);

      expect(await screen.findByTestId(selectors.components.NavToolbar.editDashboard.editButton)).toBeInTheDocument();
    });
  });

  describe('DashboardControlActions save button visibility', () => {
    const originalFeatureToggles = { ...config.featureToggles };
    const mockedContextSrv = jest.mocked(contextSrv);

    beforeEach(() => {
      config.featureToggles.dashboardNewLayouts = true;
      jest.mocked(playlistSrv.useState).mockReturnValue({ isPlaying: false });
      mockedContextSrv.hasEditPermissionInFolders = false;
    });

    afterEach(() => {
      config.featureToggles = originalFeatureToggles;
      jest.clearAllMocks();
    });

    it('should show save button when user has canSave permission and is editing', async () => {
      const controls = buildTestSceneWithEditable({ canSave: true, canEdit: true, isEditing: true });
      renderInGrafanaContext(<controls.Component model={controls} />);

      expect(await screen.findByTestId(selectors.components.NavToolbar.editDashboard.saveButton)).toBeInTheDocument();
    });

    it('should show save button when user has folder edit permission and is editing', async () => {
      mockedContextSrv.hasEditPermissionInFolders = true;
      const controls = buildTestSceneWithEditable({ canSave: false, canEdit: true, isEditing: true });
      renderInGrafanaContext(<controls.Component model={controls} />);

      expect(await screen.findByText('Save as copy')).toBeInTheDocument();
    });

    it('should not show save button when user lacks both canSave and folder edit permission', () => {
      mockedContextSrv.hasEditPermissionInFolders = false;
      const controls = buildTestSceneWithEditable({ canSave: false, canEdit: true, isEditing: true });
      renderInGrafanaContext(<controls.Component model={controls} />);

      expect(screen.queryByTestId(selectors.components.NavToolbar.editDashboard.saveButton)).not.toBeInTheDocument();
      expect(screen.queryByText('Save as copy')).not.toBeInTheDocument();
    });
  });
});

function buildTestSceneWithEditable(options: {
  hasUid?: boolean;
  editable?: boolean;
  isEditing?: boolean;
  canEdit?: boolean;
  canSave?: boolean;
  canMakeEditable?: boolean;
  isSnapshot?: boolean;
}): DashboardControls {
  const {
    editable = true,
    isEditing,
    canEdit = true,
    canSave,
    canMakeEditable = false,
    isSnapshot = false,
    hasUid = true,
  } = options;

  const dashboard = new DashboardScene({
    uid: hasUid ? 'test-uid' : undefined,
    editable,
    isEditing,
    meta: {
      canEdit,
      canSave,
      canMakeEditable,
      isSnapshot,
    },
    controls: new DashboardControls({}),
  });

  dashboard.activate();

  return dashboard.state.controls as DashboardControls;
}

function getDashboard(controls: DashboardControls): DashboardScene {
  return getDashboardSceneFor(controls);
}

function buildTestScene(state?: Partial<DashboardControlsState>): DashboardControls {
  const variable = new TextBoxVariable({
    name: 'A',
    label: 'A',
    description: 'A',
    type: 'textbox',
    value: 'Text',
  });
  const dashboard = new DashboardScene({
    uid: 'A',
    links: [
      {
        title: 'Link',
        url: 'http://localhost:3000/$A',
        type: 'link',
        asDropdown: false,
        icon: '',
        includeVars: true,
        keepTime: true,
        tags: [],
        targetBlank: false,
        tooltip: 'Link',
      },
      {
        title: 'Link (dashboard controls)',
        url: 'http://localhost:3000/$A',
        type: 'link',
        asDropdown: false,
        icon: '',
        includeVars: true,
        keepTime: true,
        tags: [],
        targetBlank: false,
        tooltip: 'Link',
        placement: 'inControlsMenu',
      },
    ],
    $variables: new SceneVariableSet({
      variables: [variable],
    }),
    controls: new DashboardControls({
      ...state,
    }),
  });

  dashboard.activate();
  variable.activate();

  return dashboard.state.controls as DashboardControls;
}

async function assertPanelEditVariableVisibility({
  sceneBuilder,
  featureFlags,
  expectedVisible = [],
  expectedHidden = [],
  expectedUnique = [],
}: {
  sceneBuilder: () => { controls: DashboardControls };
  featureFlags?: Record<string, boolean>;
  expectedVisible?: string[];
  expectedHidden?: string[];
  expectedUnique?: string[];
}) {
  setTestFlags(featureFlags ?? {});
  const { controls } = sceneBuilder();
  render(<controls.Component model={controls} />);

  for (const variableName of expectedVisible) {
    expect(await screen.findByText(variableName)).toBeInTheDocument();
  }

  for (const variableName of expectedHidden) {
    expect(screen.queryByText(variableName)).not.toBeInTheDocument();
  }

  for (const variableName of expectedUnique) {
    expect(screen.queryAllByText(variableName)).toHaveLength(1);
  }
}

function buildPanelEditVariablesScene() {
  return buildPanelEditControlsScene({
    uid: 'panel-edit-variables',
    editedPanelKey: 'edited-panel',
    rows: [
      new RowItem({
        title: 'Ancestor row',
        $variables: new SceneVariableSet({
          variables: [
            new TextBoxVariable({ name: 'ancestorVar', value: 'from-ancestor' }),
            new TextBoxVariable({ name: 'dupVar', value: 'from-ancestor' }),
          ],
        }),
      }),
      new RowItem({
        title: 'Other row',
        $variables: new SceneVariableSet({
          variables: [new TextBoxVariable({ name: 'otherSectionVar', value: 'other' })],
        }),
      }),
    ],
    dashboardVariables: [
      new TextBoxVariable({ name: 'dashboardVar', value: 'from-dashboard' }),
      new TextBoxVariable({ name: 'dupVar', value: 'from-dashboard' }),
    ],
  });
}

function buildPanelViewVariablesScene() {
  const { dashboard, controls, editedPanel } = buildPanelEditControlsScene({
    uid: 'panel-view-variables',
    editedPanelKey: 'edited-panel',
    rows: [
      new RowItem({
        title: 'Ancestor row',
        $variables: new SceneVariableSet({
          variables: [
            new TextBoxVariable({ name: 'ancestorVar', value: 'from-ancestor' }),
            new TextBoxVariable({ name: 'dupVar', value: 'from-ancestor' }),
          ],
        }),
      }),
      new RowItem({
        title: 'Other row',
        $variables: new SceneVariableSet({
          variables: [new TextBoxVariable({ name: 'otherSectionVar', value: 'other' })],
        }),
      }),
    ],
    dashboardVariables: [
      new TextBoxVariable({ name: 'dashboardVar', value: 'from-dashboard' }),
      new TextBoxVariable({ name: 'dupVar', value: 'from-dashboard' }),
    ],
  });

  dashboard.setState({ editPanel: undefined, viewPanel: editedPanel.getPathId() });

  return { controls };
}

function buildPanelEditSceneWithRepeatVariable() {
  return buildPanelEditControlsScene({
    uid: 'panel-edit-repeat',
    editedPanelKey: 'repeat-panel',
    rows: [
      new RowItem({
        title: 'Repeat row',
        repeatByVariable: 'repeatSource',
        $variables: new SceneVariableSet({
          variables: [
            new LocalValueVariable({ name: 'repeatSource', value: 'local-repeat-value', text: 'local-repeat-value' }),
            new CustomVariable({ name: 'repeatSource', query: 'sec1,sec2', value: ['sec1'], text: ['sec1'] }),
          ],
        }),
      }),
    ],
    dashboardVariables: [new TextBoxVariable({ name: 'dashboardVar', value: 'from-dashboard' })],
  });
}

function buildPanelEditControlsScene({
  uid,
  editedPanelKey,
  rows,
  dashboardVariables,
}: {
  uid: string;
  editedPanelKey: string;
  rows: RowItem[];
  dashboardVariables: Array<TextBoxVariable | CustomVariable>;
}) {
  const editedPanel = new VizPanel({ key: editedPanelKey, pluginId: 'text' });
  const rowItems = rows.map((row, index) => {
    const isEditedPanelRow = index === 0;
    const panel = isEditedPanelRow ? editedPanel : new VizPanel({ key: `other-panel-${index}`, pluginId: 'text' });
    const gridItem = new DashboardGridItem({ body: panel });

    row.setState({
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [gridItem] }),
      }),
    });

    return row;
  });

  const dashboard = new DashboardScene({
    uid,
    $variables: new SceneVariableSet({
      variables: dashboardVariables,
    }),
    body: new RowsLayoutManager({ rows: rowItems }),
    controls: new DashboardControls({}),
  });

  dashboard.setState({ editPanel: buildPanelEditScene(editedPanel) });
  dashboard.activate();

  return { dashboard, controls: dashboard.state.controls as DashboardControls, editedPanel };
}
