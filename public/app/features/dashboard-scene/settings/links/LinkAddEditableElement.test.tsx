import { act } from '@testing-library/react';

import { SceneGridLayout, SceneTimeRange } from '@grafana/scenes';
import { type DashboardLink } from '@grafana/schema';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { LinkEdit, LinkEditEditableElement, linkSelectionId, openAddLinkPane } from './LinkAddEditableElement';
import { NEW_LINK } from './utils';

const createTestLink = (overrides: Partial<DashboardLink> = {}): DashboardLink => ({
  title: 'Test Link',
  type: 'link',
  url: 'https://example.com',
  icon: 'external link',
  tags: [],
  asDropdown: false,
  targetBlank: false,
  includeVars: false,
  keepTime: false,
  tooltip: 'A tooltip',
  ...overrides,
});

function buildDashboard(links: DashboardLink[] = []) {
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    links,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({ children: [] }),
    }),
  });
  activateFullSceneTree(dashboard);
  return dashboard;
}

describe('LinkAddEditableElement', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('linkSelectionId', () => {
    it('returns a formatted id for the given index', () => {
      expect(linkSelectionId(0)).toBe('dashboard-link-0');
      expect(linkSelectionId(3)).toBe('dashboard-link-3');
    });
  });

  describe('openAddLinkPane', () => {
    it('adds a new link with defaults to the dashboard', () => {
      const dashboard = buildDashboard();

      openAddLinkPane(dashboard);

      expect(dashboard.state.links).toHaveLength(1);
      expect(dashboard.state.links[0].title).toBe(NEW_LINK.title);
      expect(dashboard.state.links[0].type).toBe(NEW_LINK.type);
    });

    it('defaults asDropdown to true for new links', () => {
      const dashboard = buildDashboard();

      openAddLinkPane(dashboard);

      expect(dashboard.state.links[0].asDropdown).toBe(true);
    });

    it('appends to existing links', () => {
      const existing = createTestLink({ title: 'Existing' });
      const dashboard = buildDashboard([existing]);

      openAddLinkPane(dashboard);

      expect(dashboard.state.links).toHaveLength(2);
      expect(dashboard.state.links[0].title).toBe('Existing');
      expect(dashboard.state.links[1].title).toBe(NEW_LINK.title);
    });

    it('registers an undoable action on the edit pane', () => {
      const dashboard = buildDashboard();
      const editPane = dashboard.state.editPane;

      expect(editPane.state.undoStack).toHaveLength(0);

      openAddLinkPane(dashboard);

      expect(editPane.state.undoStack).toHaveLength(1);
    });

    it('supports undo of the added link', () => {
      const dashboard = buildDashboard([createTestLink({ title: 'Existing' })]);
      const editPane = dashboard.state.editPane;

      openAddLinkPane(dashboard);
      expect(dashboard.state.links).toHaveLength(2);

      act(() => editPane.undoAction());
      expect(dashboard.state.links).toHaveLength(1);
      expect(dashboard.state.links[0].title).toBe('Existing');
    });

    it('clears selection on undo after adding a link', () => {
      const dashboard = buildDashboard();
      const editPane = dashboard.state.editPane;

      openAddLinkPane(dashboard);
      expect(editPane.getSelectedObject()).toBeDefined();

      act(() => editPane.undoAction());
      expect(editPane.getSelectedObject()).toBeUndefined();
    });

    it('reselects the link on redo after undo', () => {
      const dashboard = buildDashboard();
      const editPane = dashboard.state.editPane;

      openAddLinkPane(dashboard);
      expect(editPane.getSelectedObject()).toBeDefined();

      act(() => editPane.undoAction());
      expect(editPane.getSelectedObject()).toBeUndefined();

      act(() => editPane.redoAction());
      expect(editPane.getSelectedObject()).toBeDefined();
      expect(dashboard.state.links).toHaveLength(1);
    });
  });

  describe('LinkEditEditableElement', () => {
    describe('getEditableElementInfo', () => {
      it('returns the link title as instance name', () => {
        const dashboard = buildDashboard([createTestLink({ title: 'My Link' })]);
        const linkEdit = new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex: 0 });
        const element = new LinkEditEditableElement(linkEdit);

        const info = element.getEditableElementInfo();

        expect(info.instanceName).toBe('My Link');
        expect(info.typeName).toBe('Link');
        expect(info.icon).toBe('external-link-alt');
      });

      it('returns fallback name when link index is out of bounds', () => {
        const dashboard = buildDashboard([]);
        const linkEdit = new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex: 99 });
        const element = new LinkEditEditableElement(linkEdit);

        const info = element.getEditableElementInfo();

        expect(info.instanceName).toBe('New link');
      });
    });

    describe('onDuplicate', () => {
      it('duplicates the link at the given index', () => {
        const dashboard = buildDashboard([
          createTestLink({ title: 'First' }),
          createTestLink({ title: 'Second' }),
          createTestLink({ title: 'Third' }),
        ]);
        const linkEdit = new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex: 1 });
        const element = new LinkEditEditableElement(linkEdit);

        element.onDuplicate();

        expect(dashboard.state.links).toHaveLength(4);
        expect(dashboard.state.links.map((l) => l.title)).toEqual(['First', 'Second', 'Third', 'Second - Copy']);
      });
    });

    describe('onDelete', () => {
      it('removes the link at the given index', () => {
        const dashboard = buildDashboard([createTestLink({ title: 'First' }), createTestLink({ title: 'Second' })]);
        const linkEdit = new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex: 0 });
        const element = new LinkEditEditableElement(linkEdit);

        element.onDelete();

        expect(dashboard.state.links).toHaveLength(1);
        expect(dashboard.state.links[0].title).toBe('Second');
      });

      it('does not remove any link when index is out of bounds', () => {
        const dashboard = buildDashboard([createTestLink()]);
        const linkEdit = new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex: 99 });
        const element = new LinkEditEditableElement(linkEdit);

        element.onDelete();

        expect(dashboard.state.links).toHaveLength(1);
      });

      it('registers an undoable action for the removal', () => {
        const dashboard = buildDashboard([createTestLink()]);
        const linkEdit = new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex: 0 });
        const element = new LinkEditEditableElement(linkEdit);

        element.onDelete();

        const editPane = dashboard.state.editPane;
        expect(editPane.state.undoStack).toHaveLength(1);

        act(() => editPane.undoAction());
        expect(dashboard.state.links).toHaveLength(1);
      });
    });
  });
});
