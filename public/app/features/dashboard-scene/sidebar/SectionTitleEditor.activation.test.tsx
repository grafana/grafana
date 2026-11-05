import { act, render, screen } from 'test/test-utils';

import { DashboardScene } from '../scene/DashboardScene';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';

function TitleEditor({ model }: { model: RowItem | TabItem }) {
  const categories = model.useSidebarOptions(false);
  return categories[0].items[0].renderElement();
}

it.each([
  {
    kind: 'row',
    defaultTitle: 'New row 1',
    siblingTitle: 'New row',
    create: () => {
      const model = new RowItem({ title: 'Selected section' });
      const sibling = new RowItem({ title: 'New row' });
      return { model, sibling, body: new RowsLayoutManager({ rows: [model, sibling] }) };
    },
  },
  {
    kind: 'tab',
    defaultTitle: 'New tab 1',
    siblingTitle: 'New tab',
    create: () => {
      const model = new TabItem({ title: 'Selected section' });
      const sibling = new TabItem({ title: 'New tab' });
      return { model, sibling, body: new TabsLayoutManager({ tabs: [model, sibling] }) };
    },
  },
])(
  'keeps the selected $kind title live across canvas reactivation and resets an empty title with undo',
  async ({ create, defaultTitle, siblingTitle }) => {
    const { model, sibling, body } = create();
    const dashboard = new DashboardScene({ body, isEditing: true });
    const sidebar = dashboard.state.sidebar;
    const releaseSidebar = sidebar.activate();
    let releaseCanvas: (() => void) | undefined = model.activate();
    sidebar.selectObject(model, { force: true });

    const { user, unmount } = render(<TitleEditor model={model} />);
    try {
      const input = screen.getByRole('textbox', { name: 'Title' });
      expect(input).toHaveValue('Selected section');

      // Only the canvas releases ownership; the same sidebar editor must keep its subscriptions alive.
      act(() => {
        releaseCanvas?.();
        releaseCanvas = undefined;
      });
      act(() => model.onChangeTitle('Without canvas'));
      expect(input).toHaveValue('Without canvas');
      expect(model.isActive).toBe(true);

      act(() => {
        releaseCanvas = model.activate();
      });
      act(() => model.onChangeTitle('After canvas remount'));
      expect(screen.getByRole('textbox', { name: 'Title' })).toBe(input);
      expect(input).toHaveValue('After canvas remount');

      await user.clear(input);
      expect(input).toHaveValue('');
      expect(model.state.title).toBe('');
      await user.tab();

      expect(input).toHaveValue(defaultTitle);
      expect(model.state.title).toBe(defaultTitle);
      expect(sibling.state.title).toBe(siblingTitle);
      expect(sidebar.state.undoStack).toHaveLength(1);

      act(() => sidebar.undoAction());
      expect(input).toHaveValue('After canvas remount');
      expect(model.state.title).toBe('After canvas remount');
    } finally {
      unmount();
      releaseCanvas?.();
      releaseSidebar();
    }
  }
);
