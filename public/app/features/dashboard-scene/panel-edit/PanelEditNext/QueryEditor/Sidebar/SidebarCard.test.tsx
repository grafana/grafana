import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';

import { QueryEditorType, QUERY_EDITOR_TYPE_CONFIG } from '../../constants';
import { QueryEditorProvider } from '../QueryEditorContext';
import { ds1SettingsMock, mockActions, mockQueryOptionsState, setup } from '../testUtils';
import { Transformation } from '../types';

import { QueryCard } from './QueryCard';
import { SidebarCard } from './SidebarCard';
import { TransformationCard } from './TransformationCard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
}));

const queryConfig = QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Query];
const transformationConfig = QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Transformation];

interface RenderSidebarCardProps {
  id?: string;
  isSelected?: boolean;
  onClick?: jest.Mock;
  addQuery?: jest.Mock;
  setSelectedQuery?: jest.Mock;
  config?: typeof queryConfig;
}

function renderSidebarCard({
  id = 'A',
  isSelected = false,
  onClick = jest.fn(),
  addQuery = jest.fn().mockReturnValue('B'),
  setSelectedQuery = jest.fn(),
  config = queryConfig,
}: RenderSidebarCardProps = {}) {
  // The add button starts with pointer-events: none (visible only on hover).
  // JSDOM can't simulate CSS :hover, so we skip the pointer-events check.
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const queries: DataQuery[] = [{ refId: id, datasource: { type: 'test', uid: 'test' } }];
  const actions = { ...mockActions, addQuery };

  render(
    <QueryEditorProvider
      dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
      qrState={{ queries, data: undefined, isLoading: false }}
      panelState={{
        panel: new VizPanel({ key: 'panel-1' }),
        transformations: [],
      }}
      uiState={{
        selectedQuery: queries[0],
        selectedTransformation: null,
        setSelectedQuery,
        setSelectedTransformation: jest.fn(),
        queryOptions: mockQueryOptionsState,
        selectedQueryDsData: null,
        selectedQueryDsLoading: false,
        showingDatasourceHelp: false,
        toggleDatasourceHelp: jest.fn(),
        cardType: QueryEditorType.Query,
      }}
      actions={actions}
    >
      <SidebarCard
        config={config}
        isSelected={isSelected}
        id={id}
        onClick={onClick}
        onDelete={jest.fn()}
        onToggleHide={jest.fn()}
        isHidden={false}
        onDuplicate={jest.fn()}
      >
        <span>Card content</span>
      </SidebarCard>
    </QueryEditorProvider>
  );

  return { user, addQuery, setSelectedQuery, onClick };
}

describe('SidebarCard', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  it('should select query card and deselect transformation when clicking query card', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
    const transformation: Transformation = {
      transformId: 'organize',
      registryItem: undefined,
      transformConfig: { id: 'organize', options: {} },
    };

    const setSelectedQuery = jest.fn();
    const setSelectedTransformation = jest.fn();

    const { user } = setup(
      <QueryEditorProvider
        dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
        qrState={{ queries: [query], data: undefined, isLoading: false }}
        panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [transformation] }}
        uiState={{
          selectedQuery: null,
          selectedTransformation: transformation,
          setSelectedQuery,
          setSelectedTransformation,
          queryOptions: mockQueryOptionsState,
          selectedQueryDsData: null,
          selectedQueryDsLoading: false,
          showingDatasourceHelp: false,
          toggleDatasourceHelp: jest.fn(),
          cardType: QueryEditorType.Query,
        }}
        actions={mockActions}
      >
        <QueryCard query={query} />
      </QueryEditorProvider>
    );

    const queryCard = screen.getByRole('button', { name: /select card A/i });
    await user.click(queryCard);

    expect(setSelectedQuery).toHaveBeenCalledWith(query);
    expect(setSelectedTransformation).not.toHaveBeenCalled();
  });

  it('should select transformation card and deselect query when clicking transformation card', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
    const transformation: Transformation = {
      transformId: 'organize',
      registryItem: undefined,
      transformConfig: { id: 'organize', options: {} },
    };

    const setSelectedQuery = jest.fn();
    const setSelectedTransformation = jest.fn();

    const { user } = setup(
      <QueryEditorProvider
        dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
        qrState={{ queries: [query], data: undefined, isLoading: false }}
        panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [transformation] }}
        uiState={{
          selectedQuery: query,
          selectedTransformation: null,
          setSelectedQuery,
          setSelectedTransformation,
          queryOptions: mockQueryOptionsState,
          selectedQueryDsData: null,
          selectedQueryDsLoading: false,
          showingDatasourceHelp: false,
          toggleDatasourceHelp: jest.fn(),
          cardType: QueryEditorType.Transformation,
        }}
        actions={mockActions}
      >
        <TransformationCard transformation={transformation} />
      </QueryEditorProvider>
    );

    const transformCard = screen.getByRole('button', { name: /select card organize/i });
    await user.click(transformCard);

    expect(setSelectedTransformation).toHaveBeenCalledWith(transformation);
    expect(setSelectedQuery).not.toHaveBeenCalled();
  });

  describe('add button and menu', () => {
    it('renders the card and add button', () => {
      renderSidebarCard();

      expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add below A/i })).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('does not render the add button for transformation cards', () => {
      renderSidebarCard({ config: transformationConfig });

      expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /add below A/i })).not.toBeInTheDocument();
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

  describe('expression type submenu', () => {
    it('clicking "Add expression" shows the expression type submenu', async () => {
      const { user } = renderSidebarCard();

      await user.click(screen.getByRole('button', { name: /add below A/i }));
      await user.click(screen.getByRole('menuitem', { name: /add expression/i }));

      // Expression types should now be visible
      expect(screen.getByRole('menuitem', { name: /^Math$/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^Reduce$/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^Resample$/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^Threshold$/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /classic condition/i })).toBeInTheDocument();

      // Back button should be present
      expect(screen.getByRole('menuitem', { name: /^Back$/i })).toBeInTheDocument();
    });

    it('clicking "Back" returns to the main menu', async () => {
      const { user } = renderSidebarCard();

      await user.click(screen.getByRole('button', { name: /add below A/i }));
      await user.click(screen.getByRole('menuitem', { name: /add expression/i }));

      // Should be in expression submenu
      expect(screen.getByRole('menuitem', { name: /^Math$/i })).toBeInTheDocument();

      await user.click(screen.getByRole('menuitem', { name: /^Back$/i }));

      // Should be back in the main menu
      expect(screen.getByRole('menuitem', { name: /add query/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /add expression/i })).toBeInTheDocument();
    });

    it('selecting an expression type calls addQuery with expression datasource and type', async () => {
      const { user, addQuery } = renderSidebarCard({ id: 'A' });

      await user.click(screen.getByRole('button', { name: /add below A/i }));
      await user.click(screen.getByRole('menuitem', { name: /add expression/i }));
      await user.click(screen.getByRole('menuitem', { name: /^Math$/i }));

      expect(addQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'math',
          datasource: expect.objectContaining({ type: '__expr__', uid: '__expr__' }),
        }),
        'A'
      );
    });

    it('selecting "Reduce" calls addQuery with reduce type and default reducer', async () => {
      const { user, addQuery } = renderSidebarCard({ id: 'A' });

      await user.click(screen.getByRole('button', { name: /add below A/i }));
      await user.click(screen.getByRole('menuitem', { name: /add expression/i }));
      await user.click(screen.getByRole('menuitem', { name: /^Reduce$/i }));

      expect(addQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reduce',
          datasource: expect.objectContaining({ type: '__expr__', uid: '__expr__' }),
          reducer: 'mean',
        }),
        'A'
      );
    });
  });
});
