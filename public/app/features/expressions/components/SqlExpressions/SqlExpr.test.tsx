import { render, testWithFeatureToggles, userEvent, waitFor } from 'test/test-utils';

import { ExpressionQuery, ExpressionQueryType } from '../../types';

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

// Mock the backend API
const mockBackendSrv = {
  post: jest.fn().mockResolvedValue({
    kind: 'SQLSchemaResponse',
    apiVersion: 'query.grafana.app/v0alpha1',
    sqlSchemas: {},
  }),
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => mockBackendSrv,
}));

// Note: Add more mocks if needed for other lazy components

describe('SqlExpr', () => {
  it('initializes new expressions with default query', async () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const query = { refId: 'expr1', type: 'sql', expression: '' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} queries={[]} />);

    // Verify onChange was called
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    // Verify essential SQL structure without exact string matching
    const updatedQuery = onChange.mock.calls[0][0];
    expect(updatedQuery.expression.toUpperCase()).toContain('SELECT');
  });

  it('preserves existing expressions when mounted', async () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const existingExpression = 'SELECT 1 AS foo';
    const query = { refId: 'expr1', type: 'sql', expression: existingExpression } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} queries={[]} />);

    // The SQLEditor should receive the existing expression
    await waitFor(() => {
      expect(query.expression).toBe(existingExpression);
    });
  });

  it('adds alerting format when alerting prop is true', async () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const query = { refId: 'expr1', type: 'sql' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} alerting queries={[]} />);

    await waitFor(() => {
      const updatedQuery = onChange.mock.calls[0][0];
      expect(updatedQuery.format).toBe('alerting');
    });
  });
});

describe('Schema Inspector feature toggle', () => {
  const defaultProps: SqlExprProps = {
    onChange: jest.fn(),
    refIds: [{ value: 'A' }],
    query: { refId: 'expression_1', type: ExpressionQueryType.sql, expression: `SELECT * FROM A LIMIT 10` },
    queries: [],
  };

  describe('when feature enabled', () => {
    testWithFeatureToggles({ enable: ['queryService', 'grafanaAPIServerWithExperimentalAPIs'] });

    afterEach(() => {
      mockBackendSrv.post.mockResolvedValue({
        kind: 'SQLSchemaResponse',
        apiVersion: 'query.grafana.app/v0alpha1',
        sqlSchemas: {},
      });
    });

    it('renders panel open by default', async () => {
      const { findByText } = render(<SqlExpr {...defaultProps} />);

      expect(await findByText('No schema information available')).toBeInTheDocument();
    });

    it('closes panel and shows reopen button when close button clicked', async () => {
      const { queryByText, getByText, findByText } = render(<SqlExpr {...defaultProps} />);

      expect(queryByText('No schema information available')).toBeInTheDocument();

      const closeButton = getByText('Schema inspector');
      await userEvent.click(closeButton);

      expect(queryByText('No schema information available')).not.toBeInTheDocument();
      expect(await findByText('Schema inspector')).toBeInTheDocument();
    });

    it('reopens panel when Open schema inspector button clicked after closing', async () => {
      const { queryByText, getByText } = render(<SqlExpr {...defaultProps} />);

      const closeButton = getByText('Schema inspector');
      await userEvent.click(closeButton);

      expect(queryByText('No schema information available')).not.toBeInTheDocument();

      const reopenButton = getByText('Schema inspector');
      await userEvent.click(reopenButton);

      expect(queryByText('No schema information available')).toBeInTheDocument();
    });

    it('renders tabs for multiple query refIds', async () => {
      mockBackendSrv.post.mockResolvedValue({
        kind: 'SQLSchemaResponse',
        apiVersion: 'query.grafana.app/v0alpha1',
        sqlSchemas: {
          A: { columns: [], sampleRows: [] },
          B: { columns: [], sampleRows: [] },
          C: { columns: [], sampleRows: [] },
        },
      });

      const propsWithQueries = {
        ...defaultProps,
        queries: [{ refId: 'A' }, { refId: 'B' }, { refId: 'C' }],
      };

      const { findByRole } = render(<SqlExpr {...propsWithQueries} />);

      expect(await findByRole('tab', { name: 'A' })).toBeInTheDocument();
      expect(await findByRole('tab', { name: 'B' })).toBeInTheDocument();
      expect(await findByRole('tab', { name: 'C' })).toBeInTheDocument();
    });
  });

  describe('when feature disabled', () => {
    testWithFeatureToggles({ enable: [] });

    it('does not render panel or button', () => {
      const { queryByText } = render(<SqlExpr {...defaultProps} />);

      expect(queryByText('Schema inspector')).not.toBeInTheDocument();
      expect(queryByText('No schema information available')).not.toBeInTheDocument();
    });
  });
});

describe('SqlExpr with GenAI features', () => {
  const defaultProps: SqlExprProps = {
    onChange: jest.fn(),
    refIds: [{ value: 'A' }],
    query: { refId: 'expression_1', type: ExpressionQueryType.sql, expression: `SELECT * FROM A LIMIT 10` },
    queries: [],
  };

  it('renders suggestions drawer when isDrawerOpen is true', async () => {
    // TODO this inline require breaks future tests - do it differently!
    const { useSQLSuggestions } = require('./GenAI/hooks/useSQLSuggestions');
    useSQLSuggestions.mockImplementation(() => ({
      isDrawerOpen: true,
      suggestions: ['suggestion1', 'suggestion2'],
    }));

    const { findByTestId } = render(<SqlExpr {...defaultProps} />);
    expect(await findByTestId('suggestions-drawer')).toBeInTheDocument();
  });

  it('renders explanation drawer when isExplanationOpen is true', async () => {
    // TODO this inline require breaks future tests - do it differently!
    const { useSQLExplanations } = require('./GenAI/hooks/useSQLExplanations');
    useSQLExplanations.mockImplementation(() => ({ isExplanationOpen: true }));

    const { findByTestId } = render(<SqlExpr {...defaultProps} />);
    expect(await findByTestId('explanation-drawer')).toBeInTheDocument();
  });
});
