import { render } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { SceneVariableSet, TextBoxVariable } from '@grafana/scenes';

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
