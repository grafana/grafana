import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../../constants';
import { ds1SettingsMock, renderWithQueryEditorProvider } from '../../testUtils';
import { type Transformation } from '../../types';

import { QueryCard } from './QueryCard';
import { SidebarCard } from './SidebarCard';
import { TransformationCard } from './TransformationCard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
}));

interface RenderSidebarCardProps {
  id?: string;
  isSelected?: boolean;
  onSelect?: jest.Mock;
  onToggleSelect?: jest.Mock;
  addQuery?: jest.Mock;
  setSelectedQuery?: jest.Mock;
  setPendingExpression?: jest.Mock;
  isHidden?: boolean;
  actionsOverrides?: {
    onDelete?: jest.Mock;
    onToggleHide?: jest.Mock;
    onDuplicate?: jest.Mock;
  };
}

function renderSidebarCard({
  id = 'A',
  isSelected = false,
  onSelect = jest.fn(),
  onToggleSelect = jest.fn(),
  addQuery = jest.fn().mockReturnValue('B'),
  setSelectedQuery = jest.fn(),
  setPendingExpression = jest.fn(),
  isHidden = false,
  actionsOverrides = {
    onDelete: jest.fn(),
    onToggleHide: jest.fn(),
    onDuplicate: jest.fn(),
  },
}: RenderSidebarCardProps = {}) {
  const queries: DataQuery[] = [{ refId: id, datasource: { type: 'test', uid: 'test' } }];
  const item = {
    name: id,
    type: QueryEditorType.Query,
    isHidden,
  };

  const result = renderWithQueryEditorProvider(
    <SidebarCard
      isSelected={isSelected}
      id={id}
      onSelect={onSelect}
      onToggleSelect={onToggleSelect}
      onDelete={actionsOverrides.onDelete}
      onToggleHide={actionsOverrides.onToggleHide}
      onDuplicate={actionsOverrides.onDuplicate}
      item={item}
    >
      <span>Card content</span>
    </SidebarCard>,
    {
      queries,
      selectedQuery: queries[0],
      uiStateOverrides: { setSelectedQuery, setPendingExpression },
      actionsOverrides: { addQuery },
    }
  );

  return { ...result, addQuery, setSelectedQuery, setPendingExpression, onSelect, onToggleSelect };
}

describe('SidebarCard', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('card body click — highlight only', () => {
    it('calls selectQuery when clicking a query card body', async () => {
      const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
      const transformation: Transformation = {
        transformId: 'organize',
        registryItem: undefined,
        transformConfig: { id: 'organize', options: {} },
      };

      const selectQuery = jest.fn();

      const user = userEvent.setup();

      renderWithQueryEditorProvider(<QueryCard query={query} />, {
        queries: [query],
        transformations: [transformation],
        selectedTransformation: transformation,
        uiStateOverrides: { selectQuery },
      });

      const queryCard = screen.getByRole('button', { name: /select card A/i });
      await user.click(queryCard);

      expect(selectQuery).toHaveBeenCalledWith(query);
    });

    it('calls selectTransformation when clicking a transformation card body', async () => {
      const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
      const transformation: Transformation = {
        transformId: 'organize',
        registryItem: undefined,
        transformConfig: { id: 'organize', options: {} },
      };

      const selectTransformation = jest.fn();

      const user = userEvent.setup();

      renderWithQueryEditorProvider(<TransformationCard transformation={transformation} />, {
        queries: [query],
        transformations: [transformation],
        selectedQuery: query,
        uiStateOverrides: { selectTransformation },
      });

      const transformCard = screen.getByRole('button', { name: /select card organize/i });
      await user.click(transformCard);

      expect(selectTransformation).toHaveBeenCalledWith(transformation);
    });

    it('does not call onToggleSelect when clicking the card body', async () => {
      const { user, onSelect, onToggleSelect } = renderSidebarCard();

      await user.click(screen.getByRole('button', { name: /select card A/i }));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onToggleSelect).not.toHaveBeenCalled();
    });

    it('ignores modifier keys on the card body (no multi-select side effects)', async () => {
      const user = userEvent.setup();
      const { onSelect, onToggleSelect } = renderSidebarCard();

      const card = screen.getByRole('button', { name: /select card A/i });

      await user.keyboard('[ControlLeft>]');
      await user.click(card);
      await user.keyboard('[/ControlLeft]');

      await user.keyboard('[ShiftLeft>]');
      await user.click(card);
      await user.keyboard('[/ShiftLeft]');

      // Both clicks fire onSelect (no modifier shortcut on the card body).
      expect(onSelect).toHaveBeenCalledTimes(2);
      expect(onToggleSelect).not.toHaveBeenCalled();
    });

    it('calls onSelect when Enter is pressed on the focused card', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup();
      renderSidebarCard({ id: 'A', onSelect });

      const card = screen.getByRole('button', { name: /select card A/i });
      await user.click(card);
      onSelect.mockClear();

      await user.keyboard('[Enter]');

      expect(onSelect).toHaveBeenCalled();
    });

    it('fires a DOM blur on the focused editor even when mousedown preventDefault blocks focus transfer', async () => {
      // @hello-pangea/dnd installs a capture-phase mousedown listener that preventDefaults, so the
      // browser's native focus transfer never fires a blur on the previously focused element.
      // Without the force-blur in handleMouseDown, Monaco-like editors never see a DOM blur and
      // their pending value is never flushed through onChange before the editor unmounts.
      const onSelect = jest.fn();
      const onEditorBlur = jest.fn();
      const user = userEvent.setup();
      renderSidebarCard({ id: 'A', onSelect });

      const suppressFocusTransfer = (e: Event) => e.preventDefault();
      window.addEventListener('mousedown', suppressFocusTransfer, true);

      const editorLike = document.createElement('input');
      editorLike.addEventListener('blur', onEditorBlur, true);
      document.body.appendChild(editorLike);
      editorLike.focus();

      try {
        await user.click(screen.getByRole('button', { name: /select card A/i }));

        expect(onEditorBlur).toHaveBeenCalled();
        expect(onSelect).toHaveBeenCalled();
      } finally {
        window.removeEventListener('mousedown', suppressFocusTransfer, true);
        document.body.removeChild(editorLike);
      }
    });

    it('sets aria-pressed to true when isSelected is true', () => {
      renderSidebarCard({ id: 'A', isSelected: true });
      expect(screen.getByRole('button', { name: /select card A/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('checkbox — selection set only', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];
    const item = { name: 'A', type: QueryEditorType.Query, isHidden: false };

    it('does not render the checkbox when multi-select mode is off', () => {
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={jest.fn()}>
          <span>Card content</span>
        </SidebarCard>,
        { queries }
      );

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('renders the checkbox when multi-select mode is on', () => {
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={jest.fn()}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('does not render the checkbox just because 2+ items are in the selection set without multi-select mode', () => {
      // After the refactor, the checkbox set is only ever non-empty inside
      // multi-select mode. A "selectedQueryRefIds.length >= 2 without
      // multiSelectMode" combination is no longer reachable, but the visual
      // gate must still hold even if it appears.
      const queriesAB: DataQuery[] = [
        { refId: 'A', datasource: { type: 'test', uid: 'test' } },
        { refId: 'B', datasource: { type: 'test', uid: 'test' } },
      ];
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={jest.fn()}>
          <span>Card content</span>
        </SidebarCard>,
        { queries: queriesAB, uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] } }
      );

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('checks the checkbox when isPartOfSelection is true', () => {
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} isPartOfSelection item={item} onSelect={jest.fn()}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('clicking the checkbox calls onToggleSelect and stops propagation to the card body', async () => {
      const onSelect = jest.fn();
      const onToggleSelect = jest.fn();
      const { user } = renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={onSelect} onToggleSelect={onToggleSelect}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      await user.click(screen.getByRole('checkbox'));

      expect(onToggleSelect).toHaveBeenCalledWith({ range: false });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('Shift+click on the checkbox passes { range: true } to onToggleSelect', async () => {
      const onToggleSelect = jest.fn();
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={jest.fn()} onToggleSelect={onToggleSelect}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      await user.keyboard('[ShiftLeft>]');
      await user.click(screen.getByRole('checkbox'));
      await user.keyboard('[/ShiftLeft]');

      expect(onToggleSelect).toHaveBeenCalledWith({ range: true });
    });

    it('preventDefaults the mousedown on Shift+click to stop text selection (which would break consecutive range-selects)', () => {
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={jest.fn()} onToggleSelect={jest.fn()}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      const checkbox = screen.getByRole('checkbox');
      const wrapper = checkbox.closest('label')?.parentElement;
      if (!wrapper) {
        throw new Error('Expected checkbox to be inside a label inside a wrapper');
      }

      const shiftMouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, shiftKey: true });
      wrapper.dispatchEvent(shiftMouseDown);

      expect(shiftMouseDown.defaultPrevented).toBe(true);

      // Sanity check: plain mousedown (no shift) does NOT preventDefault so the
      // browser's normal focus / click flow stays intact.
      const plainMouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, shiftKey: false });
      wrapper.dispatchEvent(plainMouseDown);

      expect(plainMouseDown.defaultPrevented).toBe(false);
    });

    it('reads the Shift modifier from mousedown, not the (possibly-synthesized) click', () => {
      // In real browsers, clicking the styled checkmark hits the surrounding
      // <label>, which dispatches a synthesized click on the input with all
      // modifier keys reset to false. This regression check ensures we still
      // detect Shift even when the click event itself reports shiftKey: false.
      const onToggleSelect = jest.fn();
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={jest.fn()} onToggleSelect={onToggleSelect}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      const checkbox = screen.getByRole('checkbox');
      // The wrapper (parent of the Grafana <label>) carries our mousedown.
      const wrapper = checkbox.closest('label')?.parentElement;
      if (!wrapper) {
        throw new Error('Expected checkbox to be inside a label inside a wrapper');
      }

      // 1) Mouse down on the wrapper with Shift held — captures shiftKey: true.
      wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, shiftKey: true }));
      // 2) Synthesized click on the input with shiftKey: false (as the browser does).
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: false }));

      expect(onToggleSelect).toHaveBeenCalledWith({ range: true });
    });
  });

  describe('add button and menu', () => {
    it('renders the card and add button', () => {
      renderSidebarCard();

      expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add below A/i })).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('clicking "Add query" calls addQuery with the card refId as afterRefId', async () => {
      const { user, addQuery, setSelectedQuery } = renderSidebarCard({ id: 'A' });

      await user.click(screen.getByRole('button', { name: /add below A/i }));
      await user.click(screen.getByRole('menuitem', { name: /add query/i }));

      expect(addQuery).toHaveBeenCalledWith(undefined, 'A');
      expect(setSelectedQuery).toHaveBeenCalledWith({ refId: 'B', hide: false });
    });

    it('auto-highlights the newly added query', async () => {
      const addQuery = jest.fn().mockReturnValue('C');
      const { user, setSelectedQuery } = renderSidebarCard({ id: 'B', addQuery });

      await user.click(screen.getByRole('button', { name: /add below B/i }));
      await user.click(screen.getByRole('menuitem', { name: /add query/i }));

      expect(setSelectedQuery).toHaveBeenCalledWith({ refId: 'C', hide: false });
    });

    it('does not call setSelectedQuery when addQuery returns undefined', async () => {
      const addQuery = jest.fn().mockReturnValue(undefined);
      const { user, setSelectedQuery } = renderSidebarCard({ addQuery });

      await user.click(screen.getByRole('button', { name: /add below A/i }));
      await user.click(screen.getByRole('menuitem', { name: /add query/i }));

      expect(addQuery).toHaveBeenCalled();
      expect(setSelectedQuery).not.toHaveBeenCalled();
    });
  });

  describe('add expression', () => {
    it('clicking "Add expression" calls setPendingExpression with insertAfter', async () => {
      const { user, setPendingExpression } = renderSidebarCard({ id: 'A' });

      await user.click(screen.getByRole('button', { name: /add below A/i }));
      await user.click(screen.getByRole('menuitem', { name: /add expression/i }));

      expect(setPendingExpression).toHaveBeenCalledWith({ insertAfter: 'A' });
    });
  });

  describe('hover actions and hidden icon', () => {
    it('renders the hidden icon when the card is hidden', () => {
      renderSidebarCard({ id: 'A', isHidden: true });
      const icons = screen.getAllByTestId('icon-eye-slash');
      expect(icons.length).toBeGreaterThanOrEqual(2);
    });

    it('does not render the hidden icon when the card is visible', () => {
      renderSidebarCard({ id: 'A', isHidden: false });
      expect(screen.queryByTestId('icon-eye-slash')).not.toBeInTheDocument();
    });

    it('renders the hover actions when hasActions is true', () => {
      renderSidebarCard({
        id: 'A',
        actionsOverrides: { onDelete: jest.fn(), onToggleHide: jest.fn(), onDuplicate: jest.fn() },
      });

      expect(screen.getByRole('button', { name: /hide query/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /duplicate query/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remove query/i })).toBeInTheDocument();
    });

    it('does not render the hover actions when hasActions is false', () => {
      renderSidebarCard({
        id: 'A',
        actionsOverrides: { onDelete: undefined, onToggleHide: undefined, onDuplicate: undefined },
      });

      expect(screen.queryByRole('button', { name: /hide query/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /duplicate query/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /remove query/i })).not.toBeInTheDocument();
    });
  });
});
