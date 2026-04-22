import { screen } from '@testing-library/react';

import { InspectTab } from 'app/features/inspector/types';

import { QueryEditorType } from '../../constants';
import { renderWithQueryEditorProvider } from '../testUtils';

import { QueryActionsMenu } from './QueryActionsMenu';

const trackQueryMenuAction = jest.fn();
const getDashboardSceneFor = jest.fn();
const panelInspectDrawerMock = jest.fn().mockImplementation((args) => ({ kind: 'panel-inspect-drawer', args }));

jest.mock('../../tracking', () => ({
  trackQueryMenuAction: (...args: unknown[]) => trackQueryMenuAction(...args),
}));

jest.mock('../../../../utils/utils', () => ({
  getDashboardSceneFor: (...args: unknown[]) => getDashboardSceneFor(...args),
}));

jest.mock('../../../../inspect/PanelInspectDrawer', () => ({
  PanelInspectDrawer: function PanelInspectDrawer(...args: unknown[]) {
    return panelInspectDrawerMock(...args);
  },
}));

describe('QueryActionsMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows duplicate/help/inspector actions for query cards and triggers duplicate callback', async () => {
    const duplicateQuery = jest.fn();
    const toggleDatasourceHelp = jest.fn();

    const { user } = renderWithQueryEditorProvider(<QueryActionsMenu />, {
      selectedQuery: { refId: 'A', datasource: { uid: 'test', type: 'test' } },
      uiStateOverrides: {
        cardType: QueryEditorType.Query,
        selectedQueryDsLoading: false,
        selectedQueryDsData: {
          datasource: {
            components: {
              QueryEditorHelp: () => null,
            },
          } as never,
        },
        showingDatasourceHelp: false,
        toggleDatasourceHelp,
      },
      actionsOverrides: { duplicateQuery },
    });

    await user.click(screen.getByRole('button', { name: /more query actions/i }));

    expect(screen.getByRole('menuitem', { name: /duplicate query/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /show data source help/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /query inspector/i })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /duplicate query/i }));
    expect(duplicateQuery).toHaveBeenCalledWith('A');
    expect(trackQueryMenuAction).toHaveBeenCalledWith('duplicate', QueryEditorType.Query);

    await user.click(screen.getByRole('button', { name: /more query actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /show data source help/i }));
    expect(toggleDatasourceHelp).toHaveBeenCalledTimes(1);
    expect(trackQueryMenuAction).toHaveBeenCalledWith('toggle_datasource_help', QueryEditorType.Query);
  });

  it('uses hide-help label when datasource help is already shown', async () => {
    const { user } = renderWithQueryEditorProvider(<QueryActionsMenu />, {
      selectedQuery: { refId: 'A', datasource: { uid: 'test', type: 'test' } },
      uiStateOverrides: {
        cardType: QueryEditorType.Query,
        selectedQueryDsLoading: false,
        selectedQueryDsData: {
          datasource: {
            components: {
              QueryEditorHelp: () => null,
            },
          } as never,
        },
        showingDatasourceHelp: true,
      },
    });

    await user.click(screen.getByRole('button', { name: /more query actions/i }));

    expect(screen.getByRole('menuitem', { name: /hide data source help/i })).toBeInTheDocument();
  });

  it('hides datasource help action for expression cards', async () => {
    const duplicateQuery = jest.fn();

    const { user } = renderWithQueryEditorProvider(<QueryActionsMenu />, {
      selectedQuery: { refId: 'B', datasource: { uid: 'test', type: 'test' } },
      uiStateOverrides: {
        cardType: QueryEditorType.Expression,
        selectedQueryDsLoading: false,
        selectedQueryDsData: {
          datasource: {
            components: {
              QueryEditorHelp: () => null,
            },
          } as never,
        },
      },
      actionsOverrides: { duplicateQuery },
    });

    await user.click(screen.getByRole('button', { name: /more expression actions/i }));

    expect(screen.getByRole('menuitem', { name: /duplicate expression/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /data source help/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /duplicate expression/i }));
    expect(duplicateQuery).toHaveBeenCalledWith('B');
    expect(trackQueryMenuAction).toHaveBeenCalledWith('duplicate', QueryEditorType.Expression);
  });

  it('opens query inspector from the dashboard scene', async () => {
    const panel = { getRef: jest.fn().mockReturnValue('panel-ref-1') } as never;
    const showModal = jest.fn();
    getDashboardSceneFor.mockReturnValue({ showModal });

    const { user } = renderWithQueryEditorProvider(<QueryActionsMenu />, {
      selectedQuery: { refId: 'A', datasource: { uid: 'test', type: 'test' } },
      panelState: { panel },
      uiStateOverrides: { cardType: QueryEditorType.Query },
    });

    await user.click(screen.getByRole('button', { name: /more query actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /query inspector/i }));

    expect(getDashboardSceneFor).toHaveBeenCalledWith(panel);
    expect(panelInspectDrawerMock).toHaveBeenCalledWith({ panelRef: 'panel-ref-1', currentTab: InspectTab.Query });
    expect(showModal).toHaveBeenCalledWith({
      kind: 'panel-inspect-drawer',
      args: { panelRef: 'panel-ref-1', currentTab: InspectTab.Query },
    });
    expect(trackQueryMenuAction).toHaveBeenCalledWith('open_inspector', QueryEditorType.Query);
  });
});
