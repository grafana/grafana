import { screen } from '@testing-library/react';

import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { renderWithQueryEditorProvider } from '../testUtils';

import { SaveButton } from './SaveButton';

// Capture the callbacks the SaveButton hands to renderSavedQueryButtons so we can invoke them
// directly, instead of standing up the whole enterprise saved-queries drawer.
let capturedOnSelectQuery: ((query: DataQuery) => void) | undefined;
let capturedOnSelectQueries: ((queries: DataQuery[]) => void) | undefined;

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({
    queryLibraryEnabled: true,
    isEditingQuery: false,
    setIsEditingQuery: jest.fn(),
    renderSavedQueryButtons: (options: {
      onSelectQuery: (query: DataQuery) => void;
      onSelectQueries?: (queries: DataQuery[]) => void;
    }) => {
      capturedOnSelectQuery = options.onSelectQuery;
      capturedOnSelectQueries = options.onSelectQueries;
      return <div data-testid="saved-query-buttons" />;
    },
  }),
}));

const selectedQuery: DataQuery = { refId: 'A', datasource: { uid: 'prom', type: 'prometheus' } };

describe('SaveButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnSelectQuery = undefined;
    capturedOnSelectQueries = undefined;
  });

  it('renders the saved-query buttons and exposes a multi-query select callback', () => {
    renderWithQueryEditorProvider(<SaveButton />, {
      selectedQuery,
      uiStateOverrides: { cardType: QueryEditorType.Query },
    });

    expect(screen.getByTestId('saved-query-buttons')).toBeInTheDocument();
    expect(capturedOnSelectQueries).toBeDefined();
  });

  it('replaces in place with the first query and inserts the rest, preserving order and refIds', () => {
    const updateSelectedQuery = jest.fn();
    const setSelectedQuery = jest.fn();
    const runQueries = jest.fn();
    const addQuery = jest.fn().mockReturnValueOnce('B').mockReturnValueOnce('C');

    renderWithQueryEditorProvider(<SaveButton />, {
      selectedQuery,
      uiStateOverrides: { cardType: QueryEditorType.Query, setSelectedQuery },
      actionsOverrides: { updateSelectedQuery, addQuery, runQueries },
    });

    const q1: DataQuery = { refId: 'X', datasource: { uid: 'prom', type: 'prometheus' } };
    const q2: DataQuery = { refId: 'Y', datasource: { uid: 'prom', type: 'prometheus' } };
    const q3: DataQuery = { refId: 'Z', datasource: { uid: 'prom', type: 'prometheus' } };

    capturedOnSelectQueries!([q1, q2, q3]);

    // First replacement takes the place of the selected query, keeping its refId.
    expect(updateSelectedQuery).toHaveBeenCalledWith({ ...q1, refId: 'A' }, 'A');
    expect(setSelectedQuery).toHaveBeenCalledWith({ ...q1, refId: 'A' });

    // The rest are inserted after the previous one, chaining the returned refIds.
    expect(addQuery).toHaveBeenNthCalledWith(1, q2, 'A');
    expect(addQuery).toHaveBeenNthCalledWith(2, q3, 'B');

    expect(runQueries).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when selecting an empty query list', () => {
    const updateSelectedQuery = jest.fn();
    const addQuery = jest.fn();
    const runQueries = jest.fn();

    renderWithQueryEditorProvider(<SaveButton />, {
      selectedQuery,
      uiStateOverrides: { cardType: QueryEditorType.Query },
      actionsOverrides: { updateSelectedQuery, addQuery, runQueries },
    });

    capturedOnSelectQueries!([]);

    expect(updateSelectedQuery).not.toHaveBeenCalled();
    expect(addQuery).not.toHaveBeenCalled();
    expect(runQueries).not.toHaveBeenCalled();
  });

  it('still replaces a single query in place via the single-query callback', () => {
    const updateSelectedQuery = jest.fn();
    const setSelectedQuery = jest.fn();
    const runQueries = jest.fn();
    const addQuery = jest.fn();

    renderWithQueryEditorProvider(<SaveButton />, {
      selectedQuery,
      uiStateOverrides: { cardType: QueryEditorType.Query, setSelectedQuery },
      actionsOverrides: { updateSelectedQuery, addQuery, runQueries },
    });

    const single: DataQuery = { refId: 'X', datasource: { uid: 'prom', type: 'prometheus' } };
    capturedOnSelectQuery!(single);

    expect(updateSelectedQuery).toHaveBeenCalledWith({ ...single, refId: 'A' }, 'A');
    expect(setSelectedQuery).toHaveBeenCalledWith({ ...single, refId: 'A' });
    expect(addQuery).not.toHaveBeenCalled();
    expect(runQueries).toHaveBeenCalledTimes(1);
  });
});
