import { fireEvent, render, waitFor } from 'test/test-utils';

import { SqlExprContextValue } from './SqlExprContext';
import { SqlQueryActions, SqlQueryActionsProps } from './SqlQueryActions';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  useStyles2: jest.fn().mockImplementation(() => ({})),
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

jest.mock('./GenAI/SuggestionsDrawerButton', () => ({
  SuggestionsDrawerButton: () => <div data-testid="suggestions-badge">Suggestions Badge</div>,
}));

// Mock SqlExprContext
const mockContextValue: SqlExprContextValue = {
  handleOpenExplanation: jest.fn(),
  shouldShowViewExplanation: false,
  handleExplain: jest.fn(),
  handleHistoryUpdate: jest.fn(),
  handleOpenDrawer: jest.fn(),
  suggestions: [],
  explanation: '',
  isExplanationOpen: false,
  isDrawerOpen: false,
  handleApplySuggestion: jest.fn(),
  handleCloseDrawer: jest.fn(),
  handleCloseExplanation: jest.fn(),
};

jest.mock('./SqlExprContext', () => ({
  useSqlExprContext: () => mockContextValue,
  SqlExprProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('SqlQueryActions', () => {
  const defaultProps: SqlQueryActionsProps = {
    executeQuery: jest.fn(),
    currentQuery: `SELECT * FROM A LIMIT 10`,
    queryContext: {},
    refIds: ['A'],
    initialQuery: `SELECT * FROM A LIMIT 10`,
    errorContext: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock context to default values
    Object.assign(mockContextValue, {
      handleOpenExplanation: jest.fn(),
      shouldShowViewExplanation: false,
      handleExplain: jest.fn(),
      handleHistoryUpdate: jest.fn(),
      handleOpenDrawer: jest.fn(),
      suggestions: [],
      explanation: '',
      isExplanationOpen: false,
      isDrawerOpen: false,
      handleApplySuggestion: jest.fn(),
      handleCloseDrawer: jest.fn(),
      handleCloseExplanation: jest.fn(),
    });
  });

  it('renders GenAI buttons with empty expression', async () => {
    const customProps = { ...defaultProps, currentQuery: '' };
    const { findByText } = render(<SqlQueryActions {...customProps} />);
    expect(await findByText('Generate suggestion')).toBeInTheDocument();
    expect(await findByText('Explain query')).toBeInTheDocument();
  });

  it('renders GenAI buttons with non-empty expression', async () => {
    const { findByText } = render(<SqlQueryActions {...defaultProps} />);
    expect(await findByText('Generate suggestion')).toBeInTheDocument();
    expect(await findByText('Explain query')).toBeInTheDocument();
  });

  it('renders "Improve query" when currentQuery differs from initialQuery', async () => {
    const customProps = {
      ...defaultProps,
      currentQuery: 'SELECT * FROM A WHERE value > 10',
    };
    const { findByText } = render(<SqlQueryActions {...customProps} />);
    expect(await findByText('Improve query')).toBeInTheDocument();
  });

  it('renders View explanation button when shouldShowViewExplanation is true', async () => {
    mockContextValue.shouldShowViewExplanation = true;

    const { findByText } = render(<SqlQueryActions {...defaultProps} />);
    expect(await findByText('View explanation')).toBeInTheDocument();
  });

  it('renders Explain query button when shouldShowViewExplanation is false', async () => {
    mockContextValue.shouldShowViewExplanation = false;

    const { findByText } = render(<SqlQueryActions {...defaultProps} />);
    expect(await findByText('Explain query')).toBeInTheDocument();
  });

  it('renders SuggestionsDrawerButton when there are suggestions', async () => {
    mockContextValue.suggestions = ['suggestion1', 'suggestion2'];

    const { findByTestId } = render(<SqlQueryActions {...defaultProps} />);
    expect(await findByTestId('suggestions-badge')).toBeInTheDocument();
  });

  it('does not render SuggestionsDrawerButton when there are no suggestions', async () => {
    mockContextValue.suggestions = [];

    const { queryByTestId } = render(<SqlQueryActions {...defaultProps} />);
    expect(await waitFor(() => queryByTestId('suggestions-badge'))).not.toBeInTheDocument();
  });

  it('calls handleOpenExplanation when View explanation is clicked', async () => {
    const mockHandleOpen = jest.fn();
    mockContextValue.shouldShowViewExplanation = true;
    mockContextValue.handleOpenExplanation = mockHandleOpen;

    const { findByText } = render(<SqlQueryActions {...defaultProps} />);
    const button = await findByText('View explanation');
    fireEvent.click(button);
    expect(mockHandleOpen).toHaveBeenCalled();
  });
});
