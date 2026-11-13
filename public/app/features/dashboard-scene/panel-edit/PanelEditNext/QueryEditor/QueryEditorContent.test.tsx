import { screen } from '@testing-library/react';
import { type ReactNode } from 'react';

import { AlertState } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../constants';

import { QueryEditorContent } from './QueryEditorContent';
import { type QueryEditorUIState } from './QueryEditorContext';
import { makeStackedMode, renderWithQueryEditorProvider } from './testUtils';
import { type AlertRule, EMPTY_ALERT, type Transformation } from './types';

// QueryEditorContent's job is composition: pick the header and the stacked or single-item body
// based on stacked-mode/picker/alert state. The children have their own tests, so we stub them
// with recognizable markers and only assert which branch was rendered.
jest.mock('./StackedEditor/StackedEditorRenderer', () => ({
  StackedEditorRenderer: () => <div data-testid="stacked-editor-renderer" />,
}));
jest.mock('./Body/QueryEditorBody', () => ({
  QueryEditorBody: ({ children }: { children: ReactNode }) => <div data-testid="query-editor-body">{children}</div>,
}));
jest.mock('./StackedEditor/SingleItemRenderer', () => ({
  SingleItemRenderer: () => <div data-testid="single-item-renderer" />,
}));
jest.mock('./CardEditorRenderer', () => ({
  CardEditorRenderer: () => <div data-testid="card-editor-renderer" />,
}));
jest.mock('./Header/QueryEditorMainHeader', () => ({
  QueryEditorMainHeader: () => <div data-testid="main-header" />,
}));
jest.mock('./Header/ContentHeader', () => ({
  ContentHeaderSceneWrapper: () => <div data-testid="content-header" />,
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
const alertRule: AlertRule = {
  alertId: 'alert-1',
  rule: { ...EMPTY_ALERT.rule, name: 'High CPU Alert' },
  state: AlertState.Alerting,
};

// Seed a query by default so empty-panel behaviour is tested explicitly below.
function renderContent(uiStateOverrides: Partial<QueryEditorUIState> = {}, queries: DataQuery[] = [query]) {
  return renderWithQueryEditorProvider(<QueryEditorContent />, { uiStateOverrides, queries });
}

describe('QueryEditorContent', () => {
  it('renders the main header above the stacked editor when stacked mode is enabled', () => {
    renderContent({ stackedMode: makeStackedMode({ enabled: true }) });

    expect(screen.getByTestId('main-header')).toBeInTheDocument();
    expect(screen.getByTestId('stacked-editor-renderer')).toBeInTheDocument();
    expect(screen.queryByTestId('single-item-renderer')).not.toBeInTheDocument();
  });

  it('renders the main header above the selected card when stacked mode is disabled', () => {
    renderContent({ stackedMode: makeStackedMode({ enabled: false }) });

    expect(screen.getByTestId('main-header')).toBeInTheDocument();
    expect(screen.getByTestId('single-item-renderer')).toBeInTheDocument();
    expect(screen.queryByTestId('stacked-editor-renderer')).not.toBeInTheDocument();
  });

  it.each([
    { name: 'a pending expression', overrides: { pendingExpression: { insertAfter: 'A' } } },
    { name: 'a pending transformation', overrides: { pendingTransformation: { insertAfter: 'A' } } },
  ])('shows $name picker with its own header and without the main header, even in stacked mode', ({ overrides }) => {
    renderContent({ stackedMode: makeStackedMode({ enabled: true }), ...overrides });

    expect(screen.getByTestId('content-header')).toBeInTheDocument();
    expect(screen.getByTestId('card-editor-renderer')).toBeInTheDocument();
    expect(screen.queryByTestId('main-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stacked-editor-renderer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('single-item-renderer')).not.toBeInTheDocument();
  });

  describe('in alert view', () => {
    it('keeps the alert header and editor without the main header or card, even in stacked mode', () => {
      renderWithQueryEditorProvider(<QueryEditorContent />, {
        queries: [query],
        alertingState: { alertRules: [alertRule] },
        uiStateOverrides: { stackedMode: makeStackedMode({ enabled: true }), cardType: QueryEditorType.Alert },
      });

      expect(screen.getByTestId('content-header')).toBeInTheDocument();
      expect(screen.getByTestId('card-editor-renderer')).toBeInTheDocument();
      expect(screen.queryByTestId('main-header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('single-item-renderer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('stacked-editor-renderer')).not.toBeInTheDocument();
    });

    it('hides the alert header when there are no alert rules', () => {
      renderContent({ cardType: QueryEditorType.Alert });

      expect(screen.queryByTestId('content-header')).not.toBeInTheDocument();
      expect(screen.getByTestId('card-editor-renderer')).toBeInTheDocument();
    });
  });

  describe('when the panel has no queries or transformations', () => {
    it('shows the empty state instead of the editor surface, even in stacked mode', () => {
      renderWithQueryEditorProvider(<QueryEditorContent />, {
        queries: [],
        transformations: [],
        uiStateOverrides: { stackedMode: makeStackedMode({ enabled: true }) },
      });

      expect(screen.getByTestId('queries-empty-state')).toBeInTheDocument();
      expect(screen.queryByTestId('main-header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('query-editor-body')).not.toBeInTheDocument();
      expect(screen.queryByTestId('stacked-editor-renderer')).not.toBeInTheDocument();
    });

    it('keeps the selected card when only transformations remain', () => {
      renderWithQueryEditorProvider(<QueryEditorContent />, { queries: [], transformations: [transformation] });

      expect(screen.queryByTestId('queries-empty-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('single-item-renderer')).toBeInTheDocument();
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
