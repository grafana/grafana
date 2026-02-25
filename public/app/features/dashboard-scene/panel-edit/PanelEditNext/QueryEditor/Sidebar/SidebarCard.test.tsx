import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { renderWithQueryEditorProvider, ds1SettingsMock } from '../testUtils';
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
  setActiveContext?: jest.Mock;
}

function renderSidebarCard({
  id = 'A',
  isSelected = false,
  onClick = jest.fn(),
  addQuery = jest.fn().mockReturnValue('B'),
  setActiveContext = jest.fn(),
}: RenderSidebarCardProps = {}) {
  const queries: DataQuery[] = [{ refId: id, datasource: { type: 'test', uid: 'test' } }];
  const item = {
    name: id,
    type: QueryEditorType.Query,
    isHidden: false,
  };

  const result = renderWithQueryEditorProvider(
    <SidebarCard
      isSelected={isSelected}
      id={id}
      onClick={onClick}
      onDelete={jest.fn()}
      onToggleHide={jest.fn()}
      onDuplicate={jest.fn()}
      item={item}
    >
      <span>Card content</span>
    </SidebarCard>,
    {
      queries,
      selectedQuery: queries[0],
      uiStateOverrides: { setActiveContext },
      actionsOverrides: { addQuery },
    }
  );

  return { ...result, addQuery, setActiveContext, onClick };
}

describe('SidebarCard', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  it('should call setActiveContext with query selection when clicking query card', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
    const transformation: Transformation = {
      transformId: 'organize',
      registryItem: undefined,
      transformConfig: { id: 'organize', options: {} },
    };

    const setActiveContext = jest.fn();
    const user = userEvent.setup();

    renderWithQueryEditorProvider(<QueryCard query={query} />, {
      queries: [query],
      transformations: [transformation],
      selectedTransformation: transformation,
      uiStateOverrides: { setActiveContext },
    });

    const queryCard = screen.getByRole('button', { name: /select card A/i });
    await user.click(queryCard);

    expect(setActiveContext).toHaveBeenCalledWith({ view: 'data', selection: { kind: 'query', refId: 'A' } });
  });

  it('should call setActiveContext with transformation selection when clicking transformation card', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
    const transformation: Transformation = {
      transformId: 'organize',
      registryItem: undefined,
      transformConfig: { id: 'organize', options: {} },
    };

    const setActiveContext = jest.fn();
    const user = userEvent.setup();

    renderWithQueryEditorProvider(<TransformationCard transformation={transformation} />, {
      queries: [query],
      transformations: [transformation],
      selectedQuery: query,
      uiStateOverrides: { setActiveContext },
    });

    const transformCard = screen.getByRole('button', { name: /select card organize/i });
    await user.click(transformCard);

    expect(setActiveContext).toHaveBeenCalledWith({
      view: 'data',
      selection: { kind: 'transformation', id: 'organize' },
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
      const { user, addQuery, setActiveContext } = renderSidebarCard({ id: 'A' });

      await user.click(screen.getByRole('button', { name: /add below A/i }));
      await user.click(screen.getByRole('menuitem', { name: /add query/i }));

      expect(addQuery).toHaveBeenCalledWith(undefined, 'A');
      expect(setActiveContext).toHaveBeenCalledWith({ view: 'data', selection: { kind: 'query', refId: 'B' } });
    });

    it('auto-selects the newly added query', async () => {
      const addQuery = jest.fn().mockReturnValue('C');
      const { user, setActiveContext } = renderSidebarCard({ id: 'B', addQuery });

      await user.click(screen.getByRole('button', { name: /add below B/i }));
      await user.click(screen.getByRole('menuitem', { name: /add query/i }));

      expect(setActiveContext).toHaveBeenCalledWith({ view: 'data', selection: { kind: 'query', refId: 'C' } });
    });

    it('does not call setActiveContext when addQuery returns undefined', async () => {
      const addQuery = jest.fn().mockReturnValue(undefined);
      const { user, setActiveContext } = renderSidebarCard({ addQuery });

      await user.click(screen.getByRole('button', { name: /add below A/i }));
      await user.click(screen.getByRole('menuitem', { name: /add query/i }));

      expect(addQuery).toHaveBeenCalled();
      expect(setActiveContext).not.toHaveBeenCalled();
    });
  });

  describe('add expression', () => {
    it('clicking "Add expression" calls setActiveContext with expressionPicker selection', async () => {
      const { user, setActiveContext } = renderSidebarCard({ id: 'A' });

      await user.click(screen.getByRole('button', { name: /add below A/i }));
      await user.click(screen.getByRole('menuitem', { name: /add expression/i }));

      expect(setActiveContext).toHaveBeenCalledWith({
        view: 'data',
        selection: { kind: 'expressionPicker', insertAfter: 'A' },
      });
    });
  });
});
