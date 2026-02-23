import { render, screen } from '@testing-library/react';

import { VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneVariableSet,
  ScopesVariable,
  TextBoxVariable,
} from '@grafana/scenes';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { DashboardControls, DashboardControlsState } from './DashboardControls';
import { DashboardScene } from './DashboardScene';

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

describe('DashboardControls', () => {
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

    describe('drilldown wrapper hidden variables', () => {
      const originalFeatureToggles = { ...config.featureToggles };

      beforeEach(() => {
        config.featureToggles = {
          dashboardNewLayouts: true,
          dashboardAdHocAndGroupByWrapper: true,
        };
      });

      afterEach(() => {
        config.featureToggles = originalFeatureToggles;
      });

      it('should render hidden group-by variable in edit mode when drilldown wrapper is enabled', async () => {
        const adHocVar = new AdHocFiltersVariable({
          name: 'filters',
          label: 'filters',
          filters: [],
          datasource: { uid: 'devscopes' },
          applicabilityEnabled: false,
        });
        const groupByVar = new GroupByVariable({
          name: 'query0',
          value: ['instance'],
          text: ['instance'],
          options: [],
          datasource: { uid: 'devscopes' },
          hide: VariableHide.hideVariable,
          applicabilityEnabled: false,
        });

        const dashboard = new DashboardScene({
          uid: 'test-dashboard',
          $variables: new SceneVariableSet({
            variables: [adHocVar, groupByVar],
          }),
          controls: new DashboardControls({}),
        });

        dashboard.activate();
        dashboard.setState({ isEditing: true });

        const controls = dashboard.state.controls as DashboardControls;
        render(<controls.Component model={controls} />);

        // Hidden variables should still be visible in edit mode.
        expect(await screen.findByText('query0')).toBeInTheDocument();
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
      });
      expect(scene.state.hideTimeControls).toBeTruthy();
      expect(scene.state.hideVariableControls).toBeTruthy();
      expect(scene.state.hideLinksControls).toBeTruthy();
      expect(scene.state.hideDashboardControls).toBeTruthy();
      scene.updateFromUrl({
        '_dash.hideTimePicker': '',
        '_dash.hideVariables': '',
        '_dash.hideLinks': '',
        '_dash.hideDashboardControls': '',
      });
      expect(scene.state.hideTimeControls).toBeTruthy();
      expect(scene.state.hideVariableControls).toBeTruthy();
      expect(scene.state.hideLinksControls).toBeTruthy();
      expect(scene.state.hideDashboardControls).toBeTruthy();
    });

    it('should not override state if no new state comes from url', () => {
      const scene = buildTestScene({
        hideTimeControls: true,
        hideVariableControls: true,
        hideLinksControls: true,
        hideDashboardControls: true,
      });
      scene.updateFromUrl({});
      expect(scene.state.hideTimeControls).toBeTruthy();
      expect(scene.state.hideVariableControls).toBeTruthy();
      expect(scene.state.hideLinksControls).toBeTruthy();
      expect(scene.state.hideDashboardControls).toBeTruthy();
    });

    it('should not call setState if no changes', () => {
      const scene = buildTestScene({
        hideTimeControls: true,
        hideVariableControls: true,
        hideLinksControls: true,
        hideDashboardControls: true,
      });
      const setState = jest.spyOn(scene, 'setState');

      scene.updateFromUrl({
        '_dash.hideTimePicker': 'true',
        '_dash.hideVariables': 'true',
        '_dash.hideLinks': 'true',
        '_dash.hideDashboardControls': 'true',
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
      jest.clearAllMocks();
    });

    it('should show EditDashboardSwitch when editable is true', async () => {
      const controls = buildTestSceneWithEditable({ editable: true, canEdit: true });
      render(<controls.Component model={controls} />);

      expect(await screen.findByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /make editable/i })).not.toBeInTheDocument();
    });

    it('should show MakeDashboardEditableButton when editable is false', async () => {
      const controls = buildTestSceneWithEditable({ editable: false, canEdit: false, canMakeEditable: true });
      render(<controls.Component model={controls} />);

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
      render(<controls.Component model={controls} />);

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /make editable/i })).not.toBeInTheDocument();
    });

    it('should not show edit buttons when playlist is playing', async () => {
      jest.mocked(playlistSrv.useState).mockReturnValue({ isPlaying: true });

      const controls = buildTestSceneWithEditable({ editable: true, canEdit: true });
      render(<controls.Component model={controls} />);

      expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.stop)).toBeInTheDocument();
    });
  });
});

function buildTestSceneWithEditable(options: {
  editable: boolean;
  canEdit?: boolean;
  canMakeEditable?: boolean;
  isSnapshot?: boolean;
}): DashboardControls {
  const { editable, canEdit = true, canMakeEditable = false, isSnapshot = false } = options;

  const dashboard = new DashboardScene({
    uid: 'test-uid',
    editable,
    meta: {
      canEdit,
      canMakeEditable,
      isSnapshot,
    },
    controls: new DashboardControls({}),
  });

  dashboard.activate();

  return dashboard.state.controls as DashboardControls;
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
