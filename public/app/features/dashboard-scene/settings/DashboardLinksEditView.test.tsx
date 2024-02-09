import { render as RTLRender } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import {
  behaviors,
  SceneGridLayout,
  SceneGridItem,
  SceneRefreshPicker,
  SceneTimeRange,
  SceneTimePicker,
} from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import { DashboardControls } from '../scene/DashboardControls';
import { DashboardLinksControls } from '../scene/DashboardLinksControls';
import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardLinksEditView } from './DashboardLinksEditView';
import { NEW_LINK } from './links/utils';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn().mockReturnValue({
    pathname: '/d/dash-1/settings/links',
    search: '',
    hash: '',
    state: null,
    key: '5nvxpbdafa',
  }),
}));

function render(component: React.ReactNode) {
  return RTLRender(<TestProvider>{component}</TestProvider>);
}

describe('DashboardLinksEditView', () => {
  describe('Url state', () => {
    let settings: DashboardLinksEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      settings = result.settings;
    });

    it('should return the correct urlKey', () => {
      expect(settings.getUrlKey()).toBe('links');
    });
  });

  describe('Dashboard updates', () => {
    let dashboard: DashboardScene;
    let settings: DashboardLinksEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      dashboard = result.dashboard;
      settings = result.settings;
    });

    it('should have isDirty false', () => {
      expect(dashboard.state.isDirty).toBeFalsy();
    });

    it('should update dashboard state when adding a link', () => {
      settings.onNewLink();

      expect(dashboard.state.links[0]).toEqual(NEW_LINK);
    });

    it('should update dashboard state when deleting a link', () => {
      dashboard.setState({ links: [NEW_LINK] });
      settings.onDelete(0);

      expect(dashboard.state.links).toEqual([]);
    });

    it('should update dashboard state when duplicating a link', () => {
      dashboard.setState({ links: [NEW_LINK] });
      settings.onDuplicate(NEW_LINK);

      expect(dashboard.state.links).toEqual([NEW_LINK, NEW_LINK]);
    });

    it('should update dashboard state when reordering a link', () => {
      dashboard.setState({
        links: [
          { ...NEW_LINK, title: 'link-1' },
          { ...NEW_LINK, title: 'link-2' },
        ],
      });
      settings.onOrderChange(0, 1);

      expect(dashboard.state.links).toEqual([
        { ...NEW_LINK, title: 'link-2' },
        { ...NEW_LINK, title: 'link-1' },
      ]);
    });

    it('should update dashboard state when editing a link', () => {
      dashboard.setState({ links: [{ ...NEW_LINK, title: 'old title' }] });
      settings.setState({ editIndex: 0 });
      settings.onUpdateLink({ ...NEW_LINK, title: 'new title' });

      expect(dashboard.state.links[0].title).toEqual('new title');
    });
  });

  describe('Edit a link', () => {
    let dashboard: DashboardScene;
    let settings: DashboardLinksEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      dashboard = result.dashboard;
      settings = result.settings;
    });

    it('should set editIndex when editing a link', () => {
      dashboard.setState({ links: [{ ...NEW_LINK, title: 'old title' }] });
      settings.onEdit(0);

      expect(settings.state.editIndex).toEqual(0);
    });

    it('should set editIndex when editing a link that does not exist', () => {
      dashboard.setState({ links: [{ ...NEW_LINK, title: 'old title' }] });
      settings.onEdit(1);

      expect(settings.state.editIndex).toBe(1);
    });

    it('should update dashboard state when editing a link', () => {
      dashboard.setState({ links: [{ ...NEW_LINK, title: 'old title' }] });
      settings.setState({ editIndex: 0 });
      settings.onUpdateLink({ ...NEW_LINK, title: 'new title' });

      expect(dashboard.state.links[0].title).toEqual('new title');
    });

    it('should update dashboard state when going back', () => {
      settings.setState({ editIndex: 0 });
      settings.onGoBack();

      expect(settings.state.editIndex).toBeUndefined();
    });
  });

  describe('Render the views', () => {
    let dashboard: DashboardScene;
    let settings: DashboardLinksEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      dashboard = result.dashboard;
      settings = result.settings;
    });

    it('should render with no errors', () => {
      expect(() => render(<settings.Component model={settings} />)).not.toThrow();
    });

    it('should render the empty state when no links', () => {
      dashboard.setState({ links: [] });
      const { getByText } = render(<settings.Component model={settings} />);

      expect(getByText('Add dashboard link')).toBeInTheDocument();
    });

    it('should render the empty state when no links', () => {
      dashboard.setState({ links: [] });
      const { getByText } = render(<settings.Component model={settings} />);

      expect(getByText('Add dashboard link')).toBeInTheDocument();
    });

    it('should render the list of link when there are links', () => {
      dashboard.setState({
        links: [
          { ...NEW_LINK, title: 'link-1' },
          { ...NEW_LINK, title: 'link-2' },
        ],
      });
      const { getByText } = render(<settings.Component model={settings} />);

      expect(getByText('link-1')).toBeInTheDocument();
      expect(getByText('link-2')).toBeInTheDocument();
      expect(getByText('New link')).toBeInTheDocument();
    });

    it('should render the list of link when the editing link does not exist', () => {
      dashboard.setState({
        links: [
          { ...NEW_LINK, title: 'link-1' },
          { ...NEW_LINK, title: 'link-2' },
        ],
      });
      settings.setState({ editIndex: 2 });
      const { getByText } = render(<settings.Component model={settings} />);

      expect(getByText('link-1')).toBeInTheDocument();
      expect(getByText('link-2')).toBeInTheDocument();
      expect(getByText('New link')).toBeInTheDocument();
    });

    it('should render the link form when the editing link does exist', () => {
      dashboard.setState({
        links: [
          { ...NEW_LINK, title: 'link-1' },
          { ...NEW_LINK, title: 'link-2' },
        ],
      });
      settings.setState({ editIndex: 1 });
      const { getByText } = render(<settings.Component model={settings} />);

      expect(getByText('Edit link')).toBeInTheDocument();
      expect(getByText('Back to list')).toBeInTheDocument();
    });
  });
});

async function buildTestScene() {
  const settings = new DashboardLinksEditView({});
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Off })],
    controls: [
      new DashboardControls({
        variableControls: [],
        linkControls: new DashboardLinksControls({}),
        timeControls: [
          new SceneTimePicker({}),
          new SceneRefreshPicker({
            intervals: ['1s'],
          }),
        ],
      }),
    ],
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: undefined,
        }),
      ],
    }),
    editview: settings,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();
  settings.activate();

  return { dashboard, settings };
}
