import { screen } from '@testing-library/react';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { type DataQuery } from '@grafana/schema';

import { type QueryEditorUIState } from '../QueryEditorContext';
import { renderWithQueryEditorProvider } from '../testUtils';

import { SingleEditorCard } from './SingleEditorCard';

jest.mock('../Header/ContentHeader', () => ({
  ContentHeaderSceneWrapper: () => <div data-testid="content-header" />,
}));
jest.mock('../CardEditorRenderer', () => ({
  CardEditorRenderer: () => <div data-testid="card-editor-renderer" />,
}));

const query: DataQuery = { refId: 'A' };

const datasource = new MockDataSourceApi();
datasource.components = { QueryEditorHelp: () => <div data-testid="datasource-cheatsheet" /> };

function renderCard(uiStateOverrides: Partial<QueryEditorUIState> = {}) {
  return renderWithQueryEditorProvider(<SingleEditorCard />, {
    queries: [query],
    selectedQuery: query,
    uiStateOverrides: { selectedQueryDsData: { datasource }, ...uiStateOverrides },
  });
}

describe('SingleEditorCard', () => {
  it('shows the datasource help between the header and the editor when help is toggled on', () => {
    renderCard({ showingDatasourceHelp: true });

    const order = screen
      .getAllByTestId(/^(content-header|datasource-cheatsheet|card-editor-renderer)$/)
      .map((el) => el.dataset.testid);

    expect(order).toEqual(['content-header', 'datasource-cheatsheet', 'card-editor-renderer']);
  });

  it('hides the datasource help when help is toggled off', () => {
    renderCard({ showingDatasourceHelp: false });

    expect(screen.getByTestId('card-editor-renderer')).toBeInTheDocument();
    expect(screen.queryByTestId('datasource-cheatsheet')).not.toBeInTheDocument();
  });

  it.each([
    { name: 'a pending expression', overrides: { pendingExpression: { insertAfter: 'A' } } },
    { name: 'a pending transformation', overrides: { pendingTransformation: { insertAfter: 'A' } } },
  ])('hides the datasource help while $name picker is open', ({ overrides }) => {
    renderCard({ showingDatasourceHelp: true, ...overrides });

    expect(screen.getByTestId('card-editor-renderer')).toBeInTheDocument();
    expect(screen.queryByTestId('datasource-cheatsheet')).not.toBeInTheDocument();
  });
});
