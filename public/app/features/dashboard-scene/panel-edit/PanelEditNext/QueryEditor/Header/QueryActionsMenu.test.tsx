import { screen } from '@testing-library/react';

import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { makeQueryActionTarget, renderWithQueryEditorProvider } from '../testUtils';

import { QueryActionsMenu } from './QueryActionsMenu';

const trackQueryMenuAction = jest.fn();

jest.mock('../../tracking', () => ({
  trackQueryMenuAction: (...args: unknown[]) => trackQueryMenuAction(...args),
}));

const queryA: DataQuery = { refId: 'A', datasource: { uid: 'test', type: 'test' } };
const queryB: DataQuery = { refId: 'B', datasource: { uid: 'test', type: 'test' } };

const dsDataWithHelp = {
  datasource: {
    components: {
      QueryEditorHelp: () => null,
    },
  } as never,
};

describe('QueryActionsMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows duplicate and help actions for query cards and triggers callbacks', async () => {
    const duplicateQuery = jest.fn();
    const toggleDatasourceHelp = jest.fn();
    const setSelectedQuery = jest.fn();

    const { user } = renderWithQueryEditorProvider(
      <QueryActionsMenu target={makeQueryActionTarget(queryA, { dsData: dsDataWithHelp })} />,
      {
        selectedQuery: queryA,
        uiStateOverrides: { showingDatasourceHelp: false, toggleDatasourceHelp, setSelectedQuery },
        actionsOverrides: { duplicateQuery },
      }
    );

    await user.click(screen.getByRole('button', { name: /more query actions/i }));

    expect(screen.getByRole('menuitem', { name: /duplicate query/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /show data source help/i })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /duplicate query/i }));
    expect(duplicateQuery).toHaveBeenCalledWith('A');
    expect(trackQueryMenuAction).toHaveBeenCalledWith('duplicate', QueryEditorType.Query, undefined);

    await user.click(screen.getByRole('button', { name: /more query actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /show data source help/i }));
    expect(toggleDatasourceHelp).toHaveBeenCalledTimes(1);
    expect(setSelectedQuery).not.toHaveBeenCalled();
    expect(trackQueryMenuAction).toHaveBeenCalledWith('toggle_datasource_help', QueryEditorType.Query, undefined);
  });

  it('uses hide-help label when datasource help is already shown', async () => {
    const { user } = renderWithQueryEditorProvider(
      <QueryActionsMenu target={makeQueryActionTarget(queryA, { dsData: dsDataWithHelp })} />,
      {
        selectedQuery: queryA,
        uiStateOverrides: { showingDatasourceHelp: true },
      }
    );

    await user.click(screen.getByRole('button', { name: /more query actions/i }));

    expect(screen.getByRole('menuitem', { name: /hide data source help/i })).toBeInTheDocument();
  });

  it('hides datasource help action for expression cards', async () => {
    const duplicateQuery = jest.fn();

    const { user } = renderWithQueryEditorProvider(
      <QueryActionsMenu
        target={makeQueryActionTarget(queryB, { cardType: QueryEditorType.Expression, dsData: dsDataWithHelp })}
      />,
      {
        selectedQuery: queryB,
        actionsOverrides: { duplicateQuery },
      }
    );

    await user.click(screen.getByRole('button', { name: /more expression actions/i }));

    expect(screen.getByRole('menuitem', { name: /duplicate expression/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /data source help/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /duplicate expression/i }));
    expect(duplicateQuery).toHaveBeenCalledWith('B');
    expect(trackQueryMenuAction).toHaveBeenCalledWith('duplicate', QueryEditorType.Expression, undefined);
  });

  it('reports the header the action came from', async () => {
    const { user } = renderWithQueryEditorProvider(
      <QueryActionsMenu target={makeQueryActionTarget(queryA, { dsData: dsDataWithHelp })} source="stacked_header" />,
      { selectedQuery: queryA }
    );

    await user.click(screen.getByRole('button', { name: /more query actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /duplicate query/i }));
    await user.click(screen.getByRole('button', { name: /more query actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /show data source help/i }));

    expect(trackQueryMenuAction).toHaveBeenCalledWith('duplicate', QueryEditorType.Query, 'stacked_header');
    expect(trackQueryMenuAction).toHaveBeenCalledWith(
      'toggle_datasource_help',
      QueryEditorType.Query,
      'stacked_header'
    );
  });

  describe('when the target is not the selected query', () => {
    it('duplicates the target query', async () => {
      const duplicateQuery = jest.fn();

      const { user } = renderWithQueryEditorProvider(<QueryActionsMenu target={makeQueryActionTarget(queryB)} />, {
        selectedQuery: queryA,
        actionsOverrides: { duplicateQuery },
      });

      await user.click(screen.getByRole('button', { name: /more query actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /duplicate query/i }));

      expect(duplicateQuery).toHaveBeenCalledWith('B');
    });

    it('offers to show help even when help is open for the selected query', async () => {
      const { user } = renderWithQueryEditorProvider(
        <QueryActionsMenu target={makeQueryActionTarget(queryB, { dsData: dsDataWithHelp })} />,
        {
          selectedQuery: queryA,
          uiStateOverrides: { showingDatasourceHelp: true },
        }
      );

      await user.click(screen.getByRole('button', { name: /more query actions/i }));

      expect(screen.getByRole('menuitem', { name: /show data source help/i })).toBeInTheDocument();
    });

    it('selects the target before toggling its help', async () => {
      const setSelectedQuery = jest.fn();
      const toggleDatasourceHelp = jest.fn();

      const { user } = renderWithQueryEditorProvider(
        <QueryActionsMenu target={makeQueryActionTarget(queryB, { dsData: dsDataWithHelp })} />,
        {
          selectedQuery: queryA,
          uiStateOverrides: { setSelectedQuery, toggleDatasourceHelp },
        }
      );

      await user.click(screen.getByRole('button', { name: /more query actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /show data source help/i }));

      expect(setSelectedQuery).toHaveBeenCalledWith(queryB);
      expect(toggleDatasourceHelp).toHaveBeenCalledTimes(1);
      expect(setSelectedQuery.mock.invocationCallOrder[0]).toBeLessThan(
        toggleDatasourceHelp.mock.invocationCallOrder[0]
      );
    });
  });
});
