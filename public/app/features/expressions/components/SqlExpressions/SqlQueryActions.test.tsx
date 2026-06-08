import { fireEvent, render } from 'test/test-utils';

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
});
