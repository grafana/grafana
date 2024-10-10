import { act, render } from '@testing-library/react';

import { toUtc } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneDataLayerControls, SceneVariableSet, TextBoxVariable, VariableValueSelectors } from '@grafana/scenes';

import { DashboardControls, DashboardControlsState } from './DashboardControls';
import { DashboardScene } from './DashboardScene';

const mockGetAnchorInfo = jest.fn((link) => ({
  href: `/dashboard/${link.title}`,
  title: link.title,
  tooltip: link.tooltip || null,
}));

// Mock the getLinkSrv function
jest.mock('app/features/panel/panellinks/link_srv', () => ({
  getLinkSrv: jest.fn(() => ({
    getAnchorInfo: mockGetAnchorInfo,
  })),
}));

describe('DashboardControls', () => {
  describe('Given a standard scene', () => {
    it('should initialize with default values', () => {
      const { controls: scene } = buildTestScene();
      expect(scene.state.variableControls).toEqual([]);
      expect(scene.state.timePicker).toBeDefined();
      expect(scene.state.refreshPicker).toBeDefined();
    });

    it('should return if time controls are hidden', () => {
      const { controls: scene } = buildTestScene({
        hideTimeControls: false,
        hideVariableControls: false,
        hideLinksControls: false,
      });
      expect(scene.hasControls()).toBeTruthy();
      scene.setState({ hideTimeControls: true });
      expect(scene.hasControls()).toBeTruthy();
      scene.setState({ hideVariableControls: true, hideLinksControls: true });
      expect(scene.hasControls()).toBeFalsy();
    });
  });

  describe('Component', () => {
    it('should render', () => {
      const { controls: scene } = buildTestScene();
      expect(() => {
        render(<scene.Component model={scene} />);
      }).not.toThrow();
    });

    it('should render visible controls', async () => {
      const { controls: scene } = buildTestScene({
        variableControls: [new VariableValueSelectors({}), new SceneDataLayerControls()],
      });
      const renderer = render(<scene.Component model={scene} />);

      expect(await renderer.findByTestId(selectors.pages.Dashboard.Controls)).toBeInTheDocument();
      expect(await renderer.findByTestId(selectors.components.DashboardLinks.container)).toBeInTheDocument();
      expect(await renderer.findByTestId(selectors.components.TimePicker.openButton)).toBeInTheDocument();
      expect(await renderer.findByTestId(selectors.components.RefreshPicker.runButtonV2)).toBeInTheDocument();
      expect(await renderer.findByTestId(selectors.pages.Dashboard.SubMenu.submenuItem)).toBeInTheDocument();
    });

    it('should render with hidden controls', async () => {
      const { controls: scene } = buildTestScene({
        hideTimeControls: true,
        hideVariableControls: true,
        hideLinksControls: true,
        variableControls: [new VariableValueSelectors({}), new SceneDataLayerControls()],
      });
      const renderer = render(<scene.Component model={scene} />);

      expect(await renderer.queryByTestId(selectors.pages.Dashboard.Controls)).not.toBeInTheDocument();
    });
  });

  describe('UrlSync', () => {
    it('should return keys', () => {
      const { controls: scene } = buildTestScene();
      // @ts-expect-error
      expect(scene._urlSync.getKeys()).toEqual(['_dash.hideTimePicker', '_dash.hideVariables', '_dash.hideLinks']);
    });

    it('should not return url state for hide flags', () => {
      const { controls: scene } = buildTestScene();
      expect(scene.getUrlState()).toEqual({});
      scene.setState({
        hideTimeControls: true,
        hideVariableControls: true,
        hideLinksControls: true,
      });
      expect(scene.getUrlState()).toEqual({});
    });

    it('should update from url', () => {
      const { controls: scene } = buildTestScene();
      scene.updateFromUrl({
        '_dash.hideTimePicker': 'true',
        '_dash.hideVariables': 'true',
        '_dash.hideLinks': 'true',
      });
      expect(scene.state.hideTimeControls).toBeTruthy();
      expect(scene.state.hideVariableControls).toBeTruthy();
      expect(scene.state.hideLinksControls).toBeTruthy();
      scene.updateFromUrl({
        '_dash.hideTimePicker': '',
        '_dash.hideVariables': '',
        '_dash.hideLinks': '',
      });
      expect(scene.state.hideTimeControls).toBeTruthy();
      expect(scene.state.hideVariableControls).toBeTruthy();
      expect(scene.state.hideLinksControls).toBeTruthy();
    });

    it('should not override state if no new state comes from url', () => {
      const { controls: scene } = buildTestScene({
        hideTimeControls: true,
        hideVariableControls: true,
        hideLinksControls: true,
      });
      scene.updateFromUrl({});
      expect(scene.state.hideTimeControls).toBeTruthy();
      expect(scene.state.hideVariableControls).toBeTruthy();
      expect(scene.state.hideLinksControls).toBeTruthy();
    });

    it('should not call setState if no changes', () => {
      const { controls: scene } = buildTestScene({
        hideTimeControls: true,
        hideVariableControls: true,
        hideLinksControls: true,
      });
      const setState = jest.spyOn(scene, 'setState');

      scene.updateFromUrl({
        '_dash.hideTimePicker': 'true',
        '_dash.hideVariables': 'true',
        '_dash.hideLinks': 'true',
      });

      expect(setState).toHaveBeenCalledTimes(0);
    });
  });

  it('Should update link hrefs when time range changes', () => {
    const { controls, dashboard } = buildTestScene();
    render(<controls.Component model={controls} />);

    //clear initial calls to getAnchorInfo
    mockGetAnchorInfo.mockClear();

    act(() => {
      // Update time range
      dashboard.state.$timeRange?.setState({
        value: {
          from: toUtc('2021-01-01'),
          to: toUtc('2021-01-02'),
          raw: { from: toUtc('2020-01-01'), to: toUtc('2020-01-02') },
        },
      });
    });

    //expect getAnchorInfo to be called after time range change
    expect(mockGetAnchorInfo).toHaveBeenCalledTimes(1);
  });
});

function buildTestScene(state?: Partial<DashboardControlsState>): {
  dashboard: DashboardScene;
  controls: DashboardControls;
} {
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

  return { dashboard, controls: dashboard.state.controls as DashboardControls };
}
