import { render } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { SceneVariableSet, ScopesVariable, TextBoxVariable } from '@grafana/scenes';
import { KioskMode } from 'app/types/dashboard';

import { DashboardControls, DashboardControlsState } from './DashboardControls';
import { DashboardScene } from './DashboardScene';

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

    it('should hide variables and links in embed kiosk mode', async () => {
      const scene = buildTestScene();

      // Set embed kiosk mode on the parent dashboard
      const dashboard = getDashboardForControls(scene);
      dashboard.setState({ kioskMode: KioskMode.Embed });

      const renderer = render(<scene.Component model={scene} />);

      // Variables submenu should not be visible
      expect(await renderer.queryByTestId(selectors.pages.Dashboard.SubMenu.submenuItem)).not.toBeInTheDocument();
      // Links should not be visible
      expect(await renderer.queryByTestId(selectors.components.DashboardLinks.container)).not.toBeInTheDocument();
      // Time picker should still be visible
      expect(await renderer.findByTestId(selectors.components.TimePicker.openButton)).toBeInTheDocument();
    });

    it('should show variables and links when NOT in embed kiosk mode', async () => {
      const scene = buildTestScene();

      // No kiosk mode set (normal mode)
      const renderer = render(<scene.Component model={scene} />);

      // Variables submenu should be visible
      expect(await renderer.findByTestId(selectors.pages.Dashboard.SubMenu.submenuItem)).toBeInTheDocument();
      // Links should be visible
      expect(await renderer.findByTestId(selectors.components.DashboardLinks.container)).toBeInTheDocument();
      // Time picker should be visible
      expect(await renderer.findByTestId(selectors.components.TimePicker.openButton)).toBeInTheDocument();
    });

    it('should show variables and links in Full kiosk mode (only chrome is hidden)', async () => {
      const scene = buildTestScene();

      // Set Full kiosk mode — this hides chrome only, not variables/links
      const dashboard = getDashboardForControls(scene);
      dashboard.setState({ kioskMode: KioskMode.Full });

      const renderer = render(<scene.Component model={scene} />);

      // Variables submenu should still be visible in Full mode
      expect(await renderer.findByTestId(selectors.pages.Dashboard.SubMenu.submenuItem)).toBeInTheDocument();
      // Links should still be visible in Full mode
      expect(await renderer.findByTestId(selectors.components.DashboardLinks.container)).toBeInTheDocument();
      // Time picker should be visible
      expect(await renderer.findByTestId(selectors.components.TimePicker.openButton)).toBeInTheDocument();
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
});

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

function getDashboardForControls(controls: DashboardControls): DashboardScene {
  return controls.parent as DashboardScene;
}
