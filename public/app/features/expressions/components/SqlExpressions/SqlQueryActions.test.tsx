import { fireEvent, render } from 'test/test-utils';

import { OpenAssistantButton } from '@grafana/assistant';

import { SqlQueryActions, type SqlQueryActionsProps } from './SqlQueryActions';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  useStyles2: jest.fn().mockImplementation(() => ({})),
}));

describe('SqlQueryActions', () => {
  const defaultProps: SqlQueryActionsProps = {
    executeQuery: jest.fn(),
    currentQuery: `SELECT * FROM A LIMIT 10`,
    queryContext: {},
    refIds: ['A'],
    initialQuery: `SELECT * FROM A LIMIT 10`,
    errorContext: [],
    schemas: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Run query button', () => {
    const { getByText } = render(<SqlQueryActions {...defaultProps} />);
    expect(getByText('Run query')).toBeInTheDocument();
  });

  it('calls executeQuery when Run query is clicked', () => {
    const executeQuery = jest.fn();
    const { getByText } = render(<SqlQueryActions {...defaultProps} executeQuery={executeQuery} />);
    fireEvent.click(getByText('Run query'));
    expect(executeQuery).toHaveBeenCalled();
  });

  it('renders OpenAssistantButton for explain', () => {
    render(<SqlQueryActions {...defaultProps} />);
    expect(OpenAssistantButton).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'grafana/expressions/sql/explain',
        title: 'Explain query',
      }),
      expect.anything()
    );
  });

  it('renders OpenAssistantButton for suggestions with "Generate suggestion" when query matches initial', () => {
    render(<SqlQueryActions {...defaultProps} />);
    expect(OpenAssistantButton).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'grafana/expressions/sql/improve',
        title: 'Generate suggestion',
      }),
      expect.anything()
    );
  });

  it('renders OpenAssistantButton for suggestions with "Improve query" when query differs from initial', () => {
    const customProps = {
      ...defaultProps,
      currentQuery: 'SELECT * FROM A WHERE value > 10',
    };
    render(<SqlQueryActions {...customProps} />);
    expect(OpenAssistantButton).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'grafana/expressions/sql/improve',
        title: 'Improve query',
      }),
      expect.anything()
    );
  });

  it('does not render suggestions button when there are no refIds and no query', () => {
    const customProps = {
      ...defaultProps,
      currentQuery: '',
      refIds: [],
    };
    render(<SqlQueryActions {...customProps} />);
    const suggestionsCall = (OpenAssistantButton as jest.Mock).mock.calls.find(
      (call) => call[0]?.origin === 'grafana/expressions/sql/improve'
    );
    expect(suggestionsCall).toBeUndefined();
  });

  it('renders suggestions button when there are refIds but no query', () => {
    const customProps = {
      ...defaultProps,
      currentQuery: '',
      refIds: ['A', 'B'],
    };
    render(<SqlQueryActions {...customProps} />);
    expect(OpenAssistantButton).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'grafana/expressions/sql/improve',
        title: 'Generate suggestion',
      }),
      expect.anything()
    );
  });
});
