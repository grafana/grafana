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

  return { ...result, addQuery, setSelectedQuery, setPendingExpression, onSelect };
}

describe('SidebarCard', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  it('should call toggleQuerySelection when clicking a query card (single-select)', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
    const transformation: Transformation = {
      transformId: 'organize',
      registryItem: undefined,
      transformConfig: { id: 'organize', options: {} },
    };

    const toggleQuerySelection = jest.fn();

    const user = userEvent.setup();

    renderWithQueryEditorProvider(<QueryCard query={query} />, {
      queries: [query],
      transformations: [transformation],
      selectedTransformation: transformation,
      uiStateOverrides: { toggleQuerySelection },
    });

    const queryCard = screen.getByRole('button', { name: /select card A/i });
    await user.click(queryCard);

    // Called with the query and no modifier (plain click)
    expect(toggleQuerySelection).toHaveBeenCalledWith(query, { multi: false, range: false });
  });

  it('should call toggleTransformationSelection when clicking a transformation card (single-select)', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
    const transformation: Transformation = {
      transformId: 'organize',
      registryItem: undefined,
      transformConfig: { id: 'organize', options: {} },
    };

    const toggleTransformationSelection = jest.fn();

    const user = userEvent.setup();

    renderWithQueryEditorProvider(<TransformationCard transformation={transformation} />, {
      queries: [query],
      transformations: [transformation],
      selectedQuery: query,
      uiStateOverrides: { toggleTransformationSelection },
    });

    const transformCard = screen.getByRole('button', { name: /select card organize/i });
    await user.click(transformCard);

    expect(toggleTransformationSelection).toHaveBeenCalledWith(transformation, { multi: false, range: false });
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

    it('auto-selects the newly added query', async () => {
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

  describe('multi-select modifiers', () => {
    it('calls onSelect with { multi: true } when Ctrl+Click', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup();
      renderSidebarCard({ id: 'A', onSelect });

      const card = screen.getByRole('button', { name: /select card A/i });
      await user.keyboard('[ControlLeft>]');
      await user.click(card);
      await user.keyboard('[/ControlLeft]');

      expect(onSelect).toHaveBeenCalledWith({ multi: true, range: false });
    });

    it('calls onSelect with { range: true } when Shift+Click', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup();
      renderSidebarCard({ id: 'A', onSelect });

      const card = screen.getByRole('button', { name: /select card A/i });
      await user.keyboard('[ShiftLeft>]');
      await user.click(card);
      await user.keyboard('[/ShiftLeft]');

      expect(onSelect).toHaveBeenCalledWith({ multi: false, range: true });
    });

    it('sets aria-pressed to true when isSelected is true', () => {
      renderSidebarCard({ id: 'A', isSelected: true });
      expect(screen.getByRole('button', { name: /select card A/i })).toHaveAttribute('aria-pressed', 'true');
    });

    it('sets aria-pressed to true when isPartOfSelection is true and isSelected is false', () => {
      const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];
      const item = { name: 'A', type: QueryEditorType.Query, isHidden: false };

      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} isPartOfSelection={true} item={item} onSelect={jest.fn()}>
          <span>Card content</span>
        </SidebarCard>,
        { queries }
      );

      expect(screen.getByRole('button', { name: /select card A/i })).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onSelect with { multi: false } when Enter is pressed on the card outside selection mode', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup();
      renderSidebarCard({ id: 'A', onSelect });

      const card = screen.getByRole('button', { name: /select card A/i });
      await user.click(card); // focus the card via userEvent so state updates are wrapped in act
      onSelect.mockClear(); // clear the click call, we only want to assert on the Enter call

      await user.keyboard('[Enter]');

      expect(onSelect).toHaveBeenCalledWith({ multi: false });
    });

    it('passes multi: true to onSelect on plain click when 2+ items are already selected', async () => {
      // Once the user is in selection mode (2+ selected via Cmd/Shift+click or
      // multi-select mode), plain clicks act as toggles instead of replacing.
      const onSelect = jest.fn();
      const queries: DataQuery[] = [
        { refId: 'A', datasource: { type: 'test', uid: 'test' } },
        { refId: 'B', datasource: { type: 'test', uid: 'test' } },
      ];
      const item = { name: 'A', type: QueryEditorType.Query, isHidden: false };

      const { user } = renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={onSelect}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] } }
      );

      await user.click(screen.getByRole('button', { name: /select card A/i }));

      expect(onSelect).toHaveBeenCalledWith({ multi: true, range: false });
    });

    it('passes multi: true to onSelect on plain click when in multi-select mode', async () => {
      const onSelect = jest.fn();
      const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];
      const item = { name: 'A', type: QueryEditorType.Query, isHidden: false };

      const { user } = renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={onSelect}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      await user.click(screen.getByRole('button', { name: /select card A/i }));

      expect(onSelect).toHaveBeenCalledWith({ multi: true, range: false });
    });

    it('passes multi: true to onSelect on Enter when in multi-select mode', async () => {
      const onSelect = jest.fn();
      const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];
      const item = { name: 'A', type: QueryEditorType.Query, isHidden: false };

      const { user } = renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={onSelect}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      const card = screen.getByRole('button', { name: /select card A/i });
      await user.click(card);
      onSelect.mockClear();

      await user.keyboard('[Enter]');

      expect(onSelect).toHaveBeenCalledWith({ multi: true });
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
  });

  describe('multi-select checkbox', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];
    const item = { name: 'A', type: QueryEditorType.Query, isHidden: false };

    it('does not render the checkbox when multi-select mode is off', () => {
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={jest.fn()}>
          <span>Card content</span>
        </SidebarCard>,
        { queries }
      );

      // aria-hidden wraps the checkbox, so query with { hidden: true }
      expect(screen.queryByRole('checkbox', { hidden: true })).not.toBeInTheDocument();
    });

    it('renders the checkbox when multi-select mode is on', () => {
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} item={item} onSelect={jest.fn()}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      expect(screen.getByRole('checkbox', { hidden: true })).toBeInTheDocument();
    });

    it('renders the checkbox when 2+ items are selected via keyboard shortcuts (no multi-select mode)', () => {
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

      expect(screen.getByRole('checkbox', { hidden: true })).toBeInTheDocument();
    });

    it('checks the checkbox when the card is selected', () => {
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected item={item} onSelect={jest.fn()}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      expect(screen.getByRole('checkbox', { hidden: true })).toBeChecked();
    });

    it('checks the checkbox when the card is part of a selection', () => {
      renderWithQueryEditorProvider(
        <SidebarCard id="A" isSelected={false} isPartOfSelection={true} item={item} onSelect={jest.fn()}>
          <span>Card content</span>
        </SidebarCard>,
        { queries, uiStateOverrides: { multiSelectMode: true } }
      );

      expect(screen.getByRole('checkbox', { hidden: true })).toBeChecked();
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
