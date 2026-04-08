import { act, fireEvent, render, screen, userEvent } from 'test/test-utils';

import { SceneGridLayout, SceneTimeRange } from '@grafana/scenes';
import { type DashboardLink } from '@grafana/schema';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { LinkEdit } from './LinkAddEditableElement';
import {
  LinkBooleanSwitch,
  LinkIconSelect,
  LinkPlacementSwitch,
  LinkTagsInput,
  LinkTextInput,
  LinkTypeSelect,
} from './LinkBasicOptions';

const LINK_TYPE_LINK: DashboardLink = {
  title: 'Test Link',
  type: 'link',
  url: 'https://example.com',
  icon: 'external link',
  tags: [],
  asDropdown: false,
  targetBlank: false,
  includeVars: false,
  keepTime: false,
  tooltip: 'Test tooltip',
};

const LINK_TYPE_DASHBOARDS: DashboardLink = {
  title: 'Dashboard Link',
  type: 'dashboards',
  url: '',
  icon: 'external link',
  tags: ['tag1'],
  asDropdown: true,
  targetBlank: false,
  includeVars: false,
  keepTime: false,
  tooltip: '',
};

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

function createLinkEdit(dashboard: DashboardScene, linkIndex = 0) {
  return new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex });
}

describe('LinkBasicOptions', () => {
  describe('LinkTextInput', () => {
    describe('prop="title"', () => {
      it('renders with the current link title', () => {
        const dashboard = buildDashboard([LINK_TYPE_LINK]);
        const linkEdit = createLinkEdit(dashboard);

        render(<LinkTextInput linkEdit={linkEdit} prop="title" />);

        expect(screen.getByRole('textbox')).toHaveValue('Test Link');
      });

      it('updates the title on change and commits on blur', async () => {
        const dashboard = buildDashboard([LINK_TYPE_LINK]);
        const linkEdit = createLinkEdit(dashboard);

        render(<LinkTextInput linkEdit={linkEdit} prop="title" />);

        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        await userEvent.clear(input);
        await userEvent.type(input, 'Updated Title');
        fireEvent.blur(input);

        expect(dashboard.state.links[0].title).toBe('Updated Title');
      });

      it('supports undo/redo for title changes', async () => {
        const dashboard = buildDashboard([LINK_TYPE_LINK]);
        const linkEdit = createLinkEdit(dashboard);
        const editPane = dashboard.state.editPane;

        render(<LinkTextInput linkEdit={linkEdit} prop="title" />);

        const input = screen.getByRole('textbox');

        fireEvent.focus(input);
        await userEvent.clear(input);
        await userEvent.type(input, 'Changed');
        fireEvent.blur(input);

        expect(input).toHaveValue('Changed');
        expect(editPane.state.undoStack).toHaveLength(1);

        act(() => editPane.undoAction());

        expect(input).toHaveValue('Test Link');
        expect(editPane.state.undoStack).toHaveLength(0);
        expect(editPane.state.redoStack).toHaveLength(1);

        act(() => editPane.redoAction());

        expect(input).toHaveValue('Changed');
      });

      it('returns null when link does not exist', () => {
        const dashboard = buildDashboard([]);
        const linkEdit = createLinkEdit(dashboard, 99);

        const { container } = render(<LinkTextInput linkEdit={linkEdit} prop="title" />);

        expect(container.innerHTML).toBe('');
      });
    });

    describe('prop="url"', () => {
      it('renders for link type with current URL', () => {
        const dashboard = buildDashboard([LINK_TYPE_LINK]);
        const linkEdit = createLinkEdit(dashboard);

        render(<LinkTextInput linkEdit={linkEdit} prop="url" />);

        expect(screen.getByRole('textbox')).toHaveValue('https://example.com');
      });

      it('returns null for dashboards type', () => {
        const dashboard = buildDashboard([LINK_TYPE_DASHBOARDS]);
        const linkEdit = createLinkEdit(dashboard);

        const { container } = render(<LinkTextInput linkEdit={linkEdit} prop="url" />);

        expect(container.innerHTML).toBe('');
      });

      it('updates URL on change and commits on blur', async () => {
        const dashboard = buildDashboard([LINK_TYPE_LINK]);
        const linkEdit = createLinkEdit(dashboard);

        render(<LinkTextInput linkEdit={linkEdit} prop="url" />);

        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        await userEvent.clear(input);
        await userEvent.type(input, 'https://new-url.com');
        fireEvent.blur(input);

        expect(dashboard.state.links[0].url).toBe('https://new-url.com');
        expect(dashboard.state.editPane.state.undoStack).toHaveLength(1);
      });
    });

    describe('prop="tooltip"', () => {
      it('renders for link type with current tooltip', () => {
        const dashboard = buildDashboard([LINK_TYPE_LINK]);
        const linkEdit = createLinkEdit(dashboard);

        render(<LinkTextInput linkEdit={linkEdit} prop="tooltip" />);

        expect(screen.getByRole('textbox')).toHaveValue('Test tooltip');
      });

      it('returns null for dashboards type', () => {
        const dashboard = buildDashboard([LINK_TYPE_DASHBOARDS]);
        const linkEdit = createLinkEdit(dashboard);

        const { container } = render(<LinkTextInput linkEdit={linkEdit} prop="tooltip" />);

        expect(container.innerHTML).toBe('');
      });
    });
  });

  describe('LinkTypeSelect', () => {
    it('clears tags when changing from dashboards to link type', async () => {
      const dashboard = buildDashboard([LINK_TYPE_DASHBOARDS]);
      const linkEdit = createLinkEdit(dashboard);

      render(<LinkTypeSelect linkEdit={linkEdit} />);

      expect(dashboard.state.links[0].tags).toEqual(['tag1']);

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(screen.getByText('Link'));

      expect(dashboard.state.links[0].type).toBe('link');
      expect(dashboard.state.links[0].tags).toEqual([]);
    });

    it('clears url and tooltip when changing from link to dashboards type', async () => {
      const dashboard = buildDashboard([LINK_TYPE_LINK]);
      const linkEdit = createLinkEdit(dashboard);

      render(<LinkTypeSelect linkEdit={linkEdit} />);

      expect(dashboard.state.links[0].url).toBe('https://example.com');

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(screen.getByText('Dashboards'));

      expect(dashboard.state.links[0].type).toBe('dashboards');
      expect(dashboard.state.links[0].url).toBe('');
      expect(dashboard.state.links[0].tooltip).toBe('');
    });
  });

  describe('LinkTagsInput', () => {
    it('renders for dashboards type', () => {
      const dashboard = buildDashboard([LINK_TYPE_DASHBOARDS]);
      const linkEdit = createLinkEdit(dashboard);

      render(<LinkTagsInput linkEdit={linkEdit} />);

      expect(screen.getByText('With tags')).toBeInTheDocument();
    });

    it('returns null for link type', () => {
      const dashboard = buildDashboard([LINK_TYPE_LINK]);
      const linkEdit = createLinkEdit(dashboard);

      const { container } = render(<LinkTagsInput linkEdit={linkEdit} />);

      expect(container.innerHTML).toBe('');
    });
  });

  describe('LinkIconSelect', () => {
    it('renders for link type', () => {
      const dashboard = buildDashboard([LINK_TYPE_LINK]);
      const linkEdit = createLinkEdit(dashboard);

      render(<LinkIconSelect linkEdit={linkEdit} />);

      expect(screen.getByText('Icon')).toBeInTheDocument();
    });

    it('returns null for dashboards type', () => {
      const dashboard = buildDashboard([LINK_TYPE_DASHBOARDS]);
      const linkEdit = createLinkEdit(dashboard);

      const { container } = render(<LinkIconSelect linkEdit={linkEdit} />);

      expect(container.innerHTML).toBe('');
    });
  });

  describe('LinkBooleanSwitch', () => {
    it('toggles keepTime', async () => {
      const dashboard = buildDashboard([LINK_TYPE_LINK]);
      const linkEdit = createLinkEdit(dashboard);

      render(<LinkBooleanSwitch linkEdit={linkEdit} id="keep-time" prop="keepTime" />);

      const toggle = document.getElementById('keep-time') as HTMLInputElement;
      expect(toggle.checked).toBe(false);

      await userEvent.click(toggle);
      expect(dashboard.state.links[0].keepTime).toBe(true);
    });

    it('toggles includeVars', async () => {
      const dashboard = buildDashboard([LINK_TYPE_LINK]);
      const linkEdit = createLinkEdit(dashboard);

      render(<LinkBooleanSwitch linkEdit={linkEdit} id="include-vars" prop="includeVars" />);

      const toggle = document.getElementById('include-vars') as HTMLInputElement;
      expect(toggle.checked).toBe(false);

      await userEvent.click(toggle);
      expect(dashboard.state.links[0].includeVars).toBe(true);
    });

    it('toggles targetBlank', async () => {
      const dashboard = buildDashboard([LINK_TYPE_LINK]);
      const linkEdit = createLinkEdit(dashboard);

      render(<LinkBooleanSwitch linkEdit={linkEdit} id="target-blank" prop="targetBlank" />);

      const toggle = document.getElementById('target-blank') as HTMLInputElement;
      expect(toggle.checked).toBe(false);

      await userEvent.click(toggle);
      expect(dashboard.state.links[0].targetBlank).toBe(true);
    });

    it('toggles asDropdown', async () => {
      const dashboard = buildDashboard([{ ...LINK_TYPE_DASHBOARDS, asDropdown: false }]);
      const linkEdit = createLinkEdit(dashboard);

      render(<LinkBooleanSwitch linkEdit={linkEdit} id="as-dropdown" prop="asDropdown" />);

      const toggle = document.getElementById('as-dropdown') as HTMLInputElement;
      expect(toggle.checked).toBe(false);

      await userEvent.click(toggle);
      expect(dashboard.state.links[0].asDropdown).toBe(true);
    });
  });

  describe('LinkPlacementSwitch', () => {
    it('sets placement to inControlsMenu', async () => {
      const dashboard = buildDashboard([LINK_TYPE_LINK]);
      const linkEdit = createLinkEdit(dashboard);

      render(<LinkPlacementSwitch linkEdit={linkEdit} id="placement" />);

      const toggle = document.getElementById('placement') as HTMLInputElement;
      await userEvent.click(toggle);
      expect(dashboard.state.links[0].placement).toBe('inControlsMenu');
    });
  });
});
