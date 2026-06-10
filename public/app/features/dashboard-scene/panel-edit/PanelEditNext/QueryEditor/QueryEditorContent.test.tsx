import { screen } from '@testing-library/react';

import { QueryEditorType } from '../constants';

import { QueryEditorContent } from './QueryEditorContent';
import { type QueryEditorUIState } from './QueryEditorContext';
import { makeStackedMode, renderWithQueryEditorProvider } from './testUtils';

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

function renderContent(uiStateOverrides: Partial<QueryEditorUIState> = {}) {
  return renderWithQueryEditorProvider(<QueryEditorContent />, { uiStateOverrides });
}

describe('QueryEditorContent', () => {
  it('renders the stacked editor when stacked mode is enabled, no picker is open, and not in alert view', () => {
    renderContent({ stackedMode: makeStackedMode({ enabled: true }) });

    expect(screen.getByTestId('stacked-editor-renderer')).toBeInTheDocument();
    expect(screen.queryByTestId('query-editor-body')).not.toBeInTheDocument();
    expect(screen.queryByTestId('query-editor-footer')).not.toBeInTheDocument();
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
    if (expectedFooter) {
      expect(screen.getByTestId('query-editor-footer')).toBeInTheDocument();
    } else {
      expect(screen.queryByTestId('query-editor-footer')).not.toBeInTheDocument();
    }
  });
});
