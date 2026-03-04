import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { ds1SettingsMock, renderWithQueryEditorProvider } from '../testUtils';
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

interface RenderSidebarCardProps {
  id?: string;
  isSelected?: boolean;
  onClick?: jest.Mock;
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
  onClick = jest.fn(),
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
      onClick={onClick}
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

  return { ...result, addQuery, setSelectedQuery, setPendingExpression, onClick };
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

    const user = userEvent.setup();

    renderWithQueryEditorProvider(<QueryCard query={query} />, {
      queries: [query],
      transformations: [transformation],
      selectedTransformation: transformation,
      uiStateOverrides: { setSelectedQuery, setSelectedTransformation },
    });

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

    const user = userEvent.setup();

    renderWithQueryEditorProvider(<TransformationCard transformation={transformation} />, {
      queries: [query],
      transformations: [transformation],
      selectedQuery: query,
      uiStateOverrides: { setSelectedQuery, setSelectedTransformation },
    });

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
