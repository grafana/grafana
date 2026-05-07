import { screen } from '@testing-library/react';

import { Actions } from './Actions';
import { ConfirmationStyle } from './DeleteConfirm';
import { renderWithQueryEditorProvider } from './QueryEditor/testUtils';
import { type ActionItem } from './actionItem';
import { QueryEditorType } from './constants';
import { trackCardAction } from './tracking';

jest.mock('./tracking', () => ({
  ...jest.requireActual('./tracking'),
  trackCardAction: jest.fn(),
}));

const trackCardActionMock = jest.mocked(trackCardAction);

const queryItem: ActionItem = {
  id: 'A',
  type: QueryEditorType.Query,
  isHidden: false,
};

interface RenderActionsOptions {
  item?: ActionItem;
  onDelete?: jest.Mock;
  onDuplicate?: jest.Mock;
  onToggleHide?: jest.Mock;
  confirmStyle?: ConfirmationStyle;
  contentHeader?: boolean;
  handleResetFocus?: jest.Mock;
}

function renderActions({
  item = queryItem,
  onDelete = jest.fn(),
  onDuplicate,
  onToggleHide,
  confirmStyle,
  contentHeader,
  handleResetFocus,
}: RenderActionsOptions = {}) {
  const result = renderWithQueryEditorProvider(
    <Actions
      item={item}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
      onToggleHide={onToggleHide}
      confirmStyle={confirmStyle}
      contentHeader={contentHeader}
      handleResetFocus={handleResetFocus}
    />
  );
  return { ...result, onDelete, onDuplicate, onToggleHide, handleResetFocus };
}

describe('Actions', () => {
  beforeEach(() => {
    trackCardActionMock.mockClear();
  });

  describe('inline delete confirmation', () => {
    it('does not delete on the first click; reveals an inline confirmation instead', async () => {
      const { user, onDelete } = renderActions();

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));

      expect(onDelete).not.toHaveBeenCalled();
      expect(trackCardActionMock).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove Query' })).not.toBeInTheDocument();
    });

    it('calls onDelete and tracks once when the confirm button is clicked', async () => {
      const { user, onDelete } = renderActions();

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(trackCardActionMock).toHaveBeenCalledWith('delete', QueryEditorType.Query, 'sidebar_card');
    });

    it('restores the trash button and does not delete when cancel is clicked', async () => {
      const { user, onDelete } = renderActions();

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Remove Query' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    });

    it('cancels the confirmation when Escape is pressed', async () => {
      const { user, onDelete } = renderActions();

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Remove Query' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    });

    it('focuses the cancel button on appearance so Enter cancels by default', async () => {
      const { user } = renderActions();

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));

      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    it('calls handleResetFocus after confirming so the originating row collapses cleanly', async () => {
      const handleResetFocus = jest.fn();
      const { user } = renderActions({ handleResetFocus });

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));
      // Reset is intentionally NOT called when the confirmation opens — the inline UI lives
      // inside the hover row and needs the row to remain focused.
      expect(handleResetFocus).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(handleResetFocus).toHaveBeenCalledTimes(1);
    });
  });

  describe('single confirmation across instances', () => {
    it("cancels item A's confirmation when the user clicks trash on item B", async () => {
      const onDeleteA = jest.fn();
      const onDeleteB = jest.fn();
      const itemA: ActionItem = { id: 'A', type: QueryEditorType.Query, isHidden: false };
      const itemB: ActionItem = { id: 'B', type: QueryEditorType.Query, isHidden: false };

      const { user } = renderWithQueryEditorProvider(
        <>
          <Actions item={itemA} onDelete={onDeleteA} />
          <Actions item={itemB} onDelete={onDeleteB} />
        </>
      );

      const trashButtons = screen.getAllByRole('button', { name: 'Remove Query' });
      expect(trashButtons).toHaveLength(2);

      await user.click(trashButtons[0]);
      expect(screen.getAllByRole('button', { name: 'Confirm' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Remove Query' })).toHaveLength(1);

      // Clicking trash on B should auto-cancel A and open the prompt for B only.
      await user.click(screen.getByRole('button', { name: 'Remove Query' }));

      expect(onDeleteA).not.toHaveBeenCalled();
      expect(onDeleteB).not.toHaveBeenCalled();
      expect(screen.getAllByRole('button', { name: 'Confirm' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Remove Query' })).toHaveLength(1);
    });

    it('does not show a confirmation on a sibling Actions whose id does not match', async () => {
      const itemA: ActionItem = { id: 'A', type: QueryEditorType.Query, isHidden: false };
      const itemB: ActionItem = { id: 'B', type: QueryEditorType.Query, isHidden: false };

      const { user } = renderWithQueryEditorProvider(
        <>
          <Actions item={itemA} onDelete={jest.fn()} />
          <Actions item={itemB} onDelete={jest.fn()} />
        </>
      );

      const [trashA] = screen.getAllByRole('button', { name: 'Remove Query' });
      await user.click(trashA);

      // Only one confirmation cluster regardless of how many Actions are mounted.
      expect(screen.getAllByRole('button', { name: 'Confirm' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
    });

    it('does not show the header confirmation when the sidebar confirmation is open for the same item', async () => {
      const item: ActionItem = { id: 'A', type: QueryEditorType.Query, isHidden: false };

      const { user } = renderWithQueryEditorProvider(
        <>
          <Actions item={item} onDelete={jest.fn()} />
          <Actions item={item} onDelete={jest.fn()} contentHeader confirmStyle={ConfirmationStyle.full} />
        </>
      );

      const [sidebarDelete] = screen.getAllByRole('button', { name: 'Remove Query' });
      await user.click(sidebarDelete);

      expect(screen.getAllByRole('button', { name: 'Confirm' })).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Confirm' })).not.toHaveTextContent('Delete');

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));

      expect(screen.getAllByRole('button', { name: 'Confirm' })).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveTextContent('Delete');
    });
  });

  describe('confirmStyle', () => {
    it('renders icon-only confirm/cancel buttons in compact mode (sidebar default)', async () => {
      const { user } = renderActions({ confirmStyle: ConfirmationStyle.compact });

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));

      const confirm = screen.getByRole('button', { name: 'Confirm' });
      const cancel = screen.getByRole('button', { name: 'Cancel' });
      // Icon-only buttons render an svg child but no visible "Delete"/"Cancel" text.
      expect(confirm).not.toHaveTextContent('Delete');
      expect(cancel).not.toHaveTextContent('Cancel');
    });

    it('hides the other action buttons in compact mode while confirming (tight hover row)', async () => {
      const { user } = renderActions({
        confirmStyle: ConfirmationStyle.compact,
        onDuplicate: jest.fn(),
        onToggleHide: jest.fn(),
      });

      expect(screen.getByRole('button', { name: 'Duplicate Query' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Hide Query' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));

      expect(screen.queryByRole('button', { name: 'Duplicate Query' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Hide Query' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('keeps the other action buttons visible in full mode while confirming (header has space)', async () => {
      const { user } = renderActions({
        confirmStyle: ConfirmationStyle.full,
        contentHeader: true,
        onDuplicate: jest.fn(),
        onToggleHide: jest.fn(),
      });

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));

      expect(screen.getByRole('button', { name: 'Duplicate Query' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Hide Query' })).toBeInTheDocument();
    });

    it('renders a text Delete button and an icon-only cancel in full mode (header)', async () => {
      const { user } = renderActions({ confirmStyle: ConfirmationStyle.full, contentHeader: true });

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));

      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveTextContent('Delete');
      // Cancel is icon-only — no visible text, accessible via aria-label only.
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveTextContent('Cancel');
    });

    it('reports the content_header source from the header context', async () => {
      const onDelete = jest.fn();
      const { user } = renderActions({ confirmStyle: ConfirmationStyle.full, contentHeader: true, onDelete });

      await user.click(screen.getByRole('button', { name: 'Remove Query' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(trackCardActionMock).toHaveBeenCalledWith('delete', QueryEditorType.Query, 'content_header');
    });
  });
});
