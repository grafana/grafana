import { screen } from '@testing-library/react';

import { CoreApp, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';
import { RowActionComponents } from 'app/features/query/components/QueryActionComponent';
import { useQueryEditorRowExtensionActions } from 'app/features/query/components/QueryEditorRowExtensionActions';

import { QueryEditorType } from '../../constants';
import { ds1SettingsMock, renderWithQueryEditorProvider } from '../testUtils';

import { PluginActions } from './PluginActions';

jest.mock('app/features/query/components/QueryEditorRowExtensionActions');

const query = { refId: 'A', rawSql: 'SELECT 1' };
const mockExtensionActions = jest.mocked(useQueryEditorRowExtensionActions);

beforeEach(() => {
  mockExtensionActions.mockReset().mockReturnValue([]);
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  jest.spyOn(RowActionComponents, 'getAllExtraRenderAction').mockReturnValue([]);
  jest.spyOn(RowActionComponents, 'getScopedExtraRenderAction').mockReturnValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PluginActions', () => {
  it('renders nothing when no actions are available', () => {
    const { container } = renderWithQueryEditorProvider(<PluginActions />, { selectedQuery: query });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders extension-only actions and forwards the selected query context', () => {
    const queries = [query, { refId: 'B' }];
    const timeRange = getDefaultTimeRange();
    mockExtensionActions.mockReturnValue([<button key="debug">Debug query</button>]);

    renderWithQueryEditorProvider(<PluginActions app={CoreApp.PanelEditor} />, {
      selectedQuery: query,
      queries,
      qrState: { data: { state: LoadingState.Done, series: [], timeRange } },
      uiStateOverrides: { selectedQueryDsData: { dsSettings: ds1SettingsMock } },
    });

    expect(screen.getByRole('button', { name: 'Debug query' })).toBeInTheDocument();
    expect(mockExtensionActions).toHaveBeenCalledWith({
      query,
      queries,
      dataSource: ds1SettingsMock,
      app: CoreApp.PanelEditor,
      timeRange,
    });
  });

  it('renders extension actions alongside existing core actions', () => {
    jest
      .mocked(RowActionComponents.getAllExtraRenderAction)
      .mockReturnValue([({ key }) => <button key={key}>Core action</button>]);
    mockExtensionActions.mockReturnValue([<button key="debug">Debug query</button>]);

    renderWithQueryEditorProvider(<PluginActions />, { selectedQuery: query });

    expect(screen.getByRole('button', { name: 'Core action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Debug query' })).toBeInTheDocument();
  });

  it.each([
    { name: 'no query is selected', selectedQuery: null, cardType: QueryEditorType.Query },
    { name: 'an expression is selected', selectedQuery: query, cardType: QueryEditorType.Expression },
  ])('hides extension actions when $name', ({ selectedQuery, cardType }) => {
    mockExtensionActions.mockReturnValue([<button key="debug">Debug query</button>]);

    const { container } = renderWithQueryEditorProvider(<PluginActions />, {
      selectedQuery,
      uiStateOverrides: { cardType },
    });

    expect(container).toBeEmptyDOMElement();
  });
});
