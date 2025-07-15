import { render, waitFor, fireEvent } from '@testing-library/react';

import { config } from '@grafana/runtime';

import { ExpressionQuery, ExpressionQueryType } from '../types';

import { SqlExpr, SqlExprProps } from './SqlExpr';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  useStyles2: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@grafana/plugin-ui', () => ({
  SQLEditor: () => <div data-testid="sql-editor">SQL Editor Mock</div>,
}));

// Mock lazy loaded GenAI components
jest.mock('./GenAI/GenAISQLSuggestionsButton', () => ({
  GenAISQLSuggestionsButton: ({ currentQuery, initialQuery }: { currentQuery: string; initialQuery: string }) => {
    const text = !currentQuery || currentQuery === initialQuery ? 'Generate suggestion' : 'Improve query';
    return <div data-testid="suggestions-button">{text}</div>;
  },
}));

jest.mock('./GenAI/GenAISQLExplainButton', () => ({
  GenAISQLExplainButton: () => <div data-testid="explain-button">Explain query</div>,
}));

// Mock custom hooks for GenAI features
jest.mock('./GenAI/hooks/useSQLSuggestions', () => ({
  useSQLSuggestions: jest.fn(() => ({
    handleApplySuggestion: jest.fn(),
    handleHistoryUpdate: jest.fn(),
    handleCloseDrawer: jest.fn(),
    handleOpenDrawer: jest.fn(),
    isDrawerOpen: false,
    hasUnseenSuggestions: false,
    suggestions: [],
  })),
}));

jest.mock('./GenAI/hooks/useSQLExplanations', () => ({
  useSQLExplanations: jest.fn((currentExpression: string) => ({
    explanation: '',
    handleCloseExplanation: jest.fn(),
    handleOpenExplanation: jest.fn(),
    handleExplain: jest.fn(),
    isExplanationOpen: false,
    shouldShowViewExplanation: false,
    updatePrevExpression: jest.fn(),
    prevExpression: currentExpression,
  })),
}));

// Note: Add more mocks if needed for other lazy components

describe('SqlExpr', () => {
  it('initializes new expressions with default query', () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const query = { refId: 'expr1', type: 'sql', expression: '' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} />);

    // Verify onChange was called
    expect(onChange).toHaveBeenCalled();

    // Verify essential SQL structure without exact string matching
    const updatedQuery = onChange.mock.calls[0][0];
    expect(updatedQuery.expression.toUpperCase()).toContain('SELECT');
  });

  it('preserves existing expressions when mounted', () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const existingExpression = 'SELECT 1 AS foo';
    const query = { refId: 'expr1', type: 'sql', expression: existingExpression } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} />);

    // Check if onChange was called
    if (onChange.mock.calls.length > 0) {
      // If called, ensure it didn't change the expression value
      const updatedQuery = onChange.mock.calls[0][0];
      expect(updatedQuery.expression).toBe(existingExpression);
    }

    // The SQLEditor should receive the existing expression
    expect(query.expression).toBe(existingExpression);
  });

  it('adds alerting format when alerting prop is true', () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const query = { refId: 'expr1', type: 'sql' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} alerting />);

    const updatedQuery = onChange.mock.calls[0][0];
    expect(updatedQuery.format).toBe('alerting');
  });
});

describe('SqlExpr with GenAI features', () => {
  beforeEach(() => (config.featureToggles.sqlExpressions = true));

  const defaultProps: SqlExprProps = {
    onChange: jest.fn(),
    refIds: [{ value: 'A' }],
    query: { refId: 'expression_1', type: ExpressionQueryType.sql, expression: `SELECT * FROM A LIMIT 10` },
  };

  it('renders GenAI buttons when feature toggle is enabled and expression is empty', async () => {
    const customProps = { ...defaultProps, query: { ...defaultProps.query, expression: '' } };
    const { findByText } = render(<SqlExpr {...customProps} />);
    expect(await findByText('Generate suggestion')).toBeInTheDocument();
    expect(await findByText('Explain query')).toBeInTheDocument();
  });

  it('renders GenAI buttons when feature toggle is enabled and expression is not empty', async () => {
    const { findByText } = render(<SqlExpr {...defaultProps} />);
    expect(await findByText('Improve query')).toBeInTheDocument();
    expect(await findByText('Explain query')).toBeInTheDocument();
  });

  it('renders "Improve query" when currentQuery differs from initialQuery', async () => {
    const customProps = {
      ...defaultProps,
      query: { ...defaultProps.query, expression: 'SELECT * FROM A WHERE value > 10' },
    };
    const { findByText } = render(<SqlExpr {...customProps} />);
    expect(await findByText('Improve query')).toBeInTheDocument();
  });

  it('does not render GenAI buttons when feature toggle is disabled', async () => {
    config.featureToggles.sqlExpressions = false;
    const { queryByTestId } = render(<SqlExpr {...defaultProps} />);
    await waitFor(() => {
      expect(queryByTestId('suggestions-button')).not.toBeInTheDocument();
      expect(queryByTestId('explain-button')).not.toBeInTheDocument();
    });
  });

  it('renders View explanation button when shouldShowViewExplanation is true', async () => {
    const { useSQLExplanations } = require('./GenAI/hooks/useSQLExplanations');
    useSQLExplanations.mockImplementation((currentExpression: string) => ({
      shouldShowViewExplanation: true,
    }));

    const { findByText } = render(<SqlExpr {...defaultProps} />);
    expect(await findByText('View explanation')).toBeInTheDocument();
  });

  it('renders Explain query button when shouldShowViewExplanation is false', async () => {
    const { useSQLExplanations } = require('./GenAI/hooks/useSQLExplanations');
    useSQLExplanations.mockImplementation((currentExpression: string) => ({
      shouldShowViewExplanation: false,
    }));

    const { findByText } = render(<SqlExpr {...defaultProps} />);
    expect(await findByText('Explain query')).toBeInTheDocument();
  });

  it('renders SuggestionsBadge when there are suggestions', async () => {
    const { useSQLSuggestions } = require('./GenAI/hooks/useSQLSuggestions');
    useSQLSuggestions.mockImplementation(() => ({ suggestions: ['suggestion1', 'suggestion2'] }));

    const { findByTestId } = render(<SqlExpr {...defaultProps} />);
    expect(await findByTestId('suggestions-badge')).toBeInTheDocument();
  });

  it('does not render SuggestionsBadge when there are no suggestions', async () => {
    const { useSQLSuggestions } = require('./GenAI/hooks/useSQLSuggestions');
    useSQLSuggestions.mockImplementation(() => ({ suggestions: [] }));

    const { queryByTestId } = render(<SqlExpr {...defaultProps} />);
    expect(await waitFor(() => queryByTestId('suggestions-badge'))).not.toBeInTheDocument();
  });

  it('calls handleOpenExplanation when View explanation is clicked', async () => {
    const { useSQLExplanations } = require('./GenAI/hooks/useSQLExplanations');
    const mockHandleOpen = jest.fn();
    useSQLExplanations.mockImplementation(() => ({
      shouldShowViewExplanation: true,
      handleOpenExplanation: mockHandleOpen,
    }));

    const { findByText } = render(<SqlExpr {...defaultProps} />);
    const button = await findByText('View explanation');
    fireEvent.click(button);
    expect(mockHandleOpen).toHaveBeenCalled();
  });

  it('renders suggestions drawer when isDrawerOpen is true', async () => {
    const { useSQLSuggestions } = require('./GenAI/hooks/useSQLSuggestions');
    useSQLSuggestions.mockImplementation(() => ({
      isDrawerOpen: true,
      suggestions: ['suggestion1', 'suggestion2'],
    }));

    const { findByTestId } = render(<SqlExpr {...defaultProps} />);
    expect(await findByTestId('suggestions-drawer')).toBeInTheDocument();
  });

  it('renders explanation drawer when isExplanationOpen is true', async () => {
    const { useSQLExplanations } = require('./GenAI/hooks/useSQLExplanations');
    useSQLExplanations.mockImplementation(() => ({ isExplanationOpen: true }));

    const { findByTestId } = render(<SqlExpr {...defaultProps} />);
    expect(await findByTestId('explanation-drawer')).toBeInTheDocument();
  });

  it('renders dot when there are unseen suggestions', async () => {
    const { useSQLSuggestions } = require('./GenAI/hooks/useSQLSuggestions');
    useSQLSuggestions.mockImplementation(() => ({ hasUnseenSuggestions: true, suggestions: ['suggestion1'] }));

    const { findByTestId } = render(<SqlExpr {...defaultProps} />);
    expect(await findByTestId('suggestions-badge-dot')).toBeInTheDocument();
  });
});
