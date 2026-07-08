import { screen } from '@testing-library/react';

import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../constants';

import { QueryEditorContent } from './QueryEditorContent';
import { type QueryEditorUIState } from './QueryEditorContext';
import { makeStackedMode, renderWithQueryEditorProvider } from './testUtils';
import { type Transformation } from './types';

// QueryEditorContent's job is composition: pick between the stacked editor and the single-edit
// body based on stacked-mode/picker/alert state. The children have their own tests, so we stub
// them with recognizable markers and only assert which branch was rendered.
jest.mock('./StackedEditor/StackedEditorRenderer', () => ({
  StackedEditorRenderer: () => <div data-testid="stacked-editor-renderer" />,
}));
jest.mock('./Body/QueryEditorBody', () => ({
  QueryEditorBody: () => <div data-testid="query-editor-body" />,
}));
jest.mock('./Footer/QueryEditorFooter', () => ({
  QueryEditorFooter: () => <div data-testid="query-editor-footer" />,
}));
jest.mock('./Header/ContentHeader', () => ({
  ContentHeaderSceneWrapper: () => <div data-testid="content-header" />,
}));
jest.mock('./Header/DatasourceHelpPanel', () => ({
  DatasourceHelpPanel: () => <div data-testid="datasource-help-panel" />,
}));
jest.mock('./QueriesEmptyState', () => ({
  QueriesEmptyState: () => <div data-testid="queries-empty-state" />,
}));

const query: DataQuery = { refId: 'A' };
const transformation: Transformation = {
  registryItem: undefined,
  transformId: 'transform-1',
  transformConfig: { id: 'reduce', options: {} },
};

// Existing branch tests assert the editor surface, which now only renders when the panel has at
// least one card. Seed a query by default so empty-panel behaviour is tested explicitly below.
function renderContent(uiStateOverrides: Partial<QueryEditorUIState> = {}, queries: DataQuery[] = [query]) {
  return renderWithQueryEditorProvider(<QueryEditorContent />, { uiStateOverrides, queries });
}

describe('QueryEditorContent', () => {
  it('renders the stacked editor when stacked mode is enabled, no picker is open, and not in alert view', () => {
    renderContent({ stackedMode: makeStackedMode({ enabled: true }) });

    expect(screen.getByTestId('stacked-editor-renderer')).toBeInTheDocument();
    expect(screen.queryByTestId('query-editor-body')).not.toBeInTheDocument();
    expect(screen.queryByTestId('query-editor-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('queries-empty-state')).not.toBeInTheDocument();
  });

  it.each([
    {
      name: 'stacked mode is disabled',
      overrides: { stackedMode: makeStackedMode({ enabled: false }) },
      expectedFooter: true,
    },
    {
      name: 'a pending expression takes over',
      overrides: { stackedMode: makeStackedMode({ enabled: true }), pendingExpression: { insertAfter: 'A' } },
      expectedFooter: false,
    },
    {
      name: 'a pending transformation takes over',
      overrides: { stackedMode: makeStackedMode({ enabled: true }), pendingTransformation: { insertAfter: 'A' } },
      expectedFooter: false,
    },
    {
      name: 'the editor is in alert view',
      overrides: { stackedMode: makeStackedMode({ enabled: true }), cardType: QueryEditorType.Alert },
      expectedFooter: false,
    },
  ])('falls back to the single-edit body when $name', ({ overrides, expectedFooter }) => {
    renderContent(overrides);

    expect(screen.queryByTestId('stacked-editor-renderer')).not.toBeInTheDocument();
    expect(screen.getByTestId('query-editor-body')).toBeInTheDocument();
    expect(screen.queryByTestId('queries-empty-state')).not.toBeInTheDocument();
    if (expectedFooter) {
      expect(screen.getByTestId('query-editor-footer')).toBeInTheDocument();
    } else {
      expect(screen.queryByTestId('query-editor-footer')).not.toBeInTheDocument();
    }
  });

  describe('when the panel has no queries or transformations', () => {
    it('shows the empty state instead of the editor surface', () => {
      renderWithQueryEditorProvider(<QueryEditorContent />, { queries: [], transformations: [] });

      expect(screen.getByTestId('queries-empty-state')).toBeInTheDocument();
      expect(screen.queryByTestId('content-header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('query-editor-body')).not.toBeInTheDocument();
      expect(screen.queryByTestId('query-editor-footer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('stacked-editor-renderer')).not.toBeInTheDocument();
    });

    it('shows the empty state even when stacked mode is enabled', () => {
      renderWithQueryEditorProvider(<QueryEditorContent />, {
        queries: [],
        transformations: [],
        uiStateOverrides: { stackedMode: makeStackedMode({ enabled: true }) },
      });

      expect(screen.getByTestId('queries-empty-state')).toBeInTheDocument();
      expect(screen.queryByTestId('stacked-editor-renderer')).not.toBeInTheDocument();
    });

    it('keeps the transformation card editor when only transformations remain', () => {
      renderWithQueryEditorProvider(<QueryEditorContent />, { queries: [], transformations: [transformation] });

      expect(screen.queryByTestId('queries-empty-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('query-editor-body')).toBeInTheDocument();
    });

    it.each([
      { name: 'a pending expression is open', overrides: { pendingExpression: { insertAfter: 'A' } } },
      { name: 'a pending transformation is open', overrides: { pendingTransformation: { insertAfter: 'A' } } },
      { name: 'a saved query picker is open', overrides: { pendingSavedQuery: { insertAfter: 'A' } } },
    ])('does not show the empty state while $name', ({ overrides }) => {
      renderWithQueryEditorProvider(<QueryEditorContent />, {
        queries: [],
        transformations: [],
        uiStateOverrides: overrides,
      });

      expect(screen.queryByTestId('queries-empty-state')).not.toBeInTheDocument();
    });

    it('does not show the empty state in alert view', () => {
      renderWithQueryEditorProvider(<QueryEditorContent />, {
        queries: [],
        transformations: [],
        uiStateOverrides: { cardType: QueryEditorType.Alert },
      });

      expect(screen.queryByTestId('queries-empty-state')).not.toBeInTheDocument();
    });
  });
});
