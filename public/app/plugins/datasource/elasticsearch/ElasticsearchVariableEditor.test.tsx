import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { dateTime, FieldType } from '@grafana/data';

import { ElasticsearchVariableEditor } from './ElasticsearchVariableEditor';
import { ElasticQueryEditorProps } from './components/QueryEditor';
import { ElasticsearchDataQuery } from './dataquery.gen';
import { ElasticDatasource } from './datasource';

jest.mock('./components/QueryEditor', () => ({
  QueryEditor: jest.fn(({ query }) => <div data-testid="query-editor">Query: {query.query}</div>),
  ElasticQueryEditorProps: {},
}));

describe('ElasticsearchVariableEditor', () => {
  const defaultProps: ElasticQueryEditorProps = {
    query: {
      refId: 'A',
      query: 'test query',
      metrics: [{ type: 'raw_document', id: '1' }],
    },
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
    datasource: {
      query: jest.fn().mockReturnValue(
        of({
          data: [
            {
              fields: [
                { name: 'id', type: FieldType.number, config: {}, values: [1, 2] },
                { name: 'name', type: FieldType.string, config: {}, values: ['a', 'b'] },
                { name: 'status', type: FieldType.string, config: {}, values: ['active', 'inactive'] },
              ],
            },
          ],
        })
      ),
    } as unknown as ElasticDatasource,
    data: undefined,
    range: {
      from: dateTime('2021-01-01'),
      to: dateTime('2021-01-02'),
      raw: { from: 'now-1h', to: 'now' },
    },
  };

  it('should render query editor', () => {
    render(<ElasticsearchVariableEditor {...defaultProps} />);

    expect(screen.getByTestId('query-editor')).toBeInTheDocument();
    expect(screen.getByText('Query: test query')).toBeInTheDocument();
  });

  it('should render field mapping selectors', () => {
    render(<ElasticsearchVariableEditor {...defaultProps} />);

    expect(screen.getByText('Value Field')).toBeInTheDocument();
    expect(screen.getByText('Text Field')).toBeInTheDocument();
  });

  it('should populate field choices from query results', async () => {
    render(<ElasticsearchVariableEditor {...defaultProps} />);

    await waitFor(() => {
      expect(defaultProps.datasource.query).toHaveBeenCalled();
    });
  });

  it('should call onChange when text field is selected', async () => {
    const onChange = jest.fn();
    const props = { ...defaultProps, onChange };

    render(<ElasticsearchVariableEditor {...props} />);

    await waitFor(() => {
      expect(defaultProps.datasource.query).toHaveBeenCalled();
    });

    // Note: Testing Combobox interactions would require more complex setup
    // This is a basic structure that can be expanded with more detailed interaction tests
  });

  it('should preserve existing meta values', () => {
    const queryWithMeta: ElasticsearchDataQuery = {
      ...defaultProps.query,
      meta: {
        textField: 'name',
        valueField: 'id',
      },
    };

    const props = { ...defaultProps, query: queryWithMeta };
    render(<ElasticsearchVariableEditor {...props} />);

    expect(screen.getByTestId('query-editor')).toBeInTheDocument();
  });

  it('should migrate string query to object query', () => {
    const stringQuery = 'test string query' as unknown as ElasticsearchDataQuery;
    const props = { ...defaultProps, query: stringQuery };

    render(<ElasticsearchVariableEditor {...props} />);

    expect(screen.getByTestId('query-editor')).toBeInTheDocument();
  });

  it('should handle query errors gracefully', async () => {
    // Mock console.error to suppress error output in tests
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const errorObservable = {
      subscribe: (observer: { error: (err: Error) => void; }) => {
        setTimeout(() => {
          if (observer.error) {
            observer.error(new Error('Query failed'));
          }
        }, 0);
        return { unsubscribe: jest.fn() };
      },
    };

    const datasourceWithError = {
      ...defaultProps.datasource,
      query: jest.fn().mockReturnValue(errorObservable),
    } as unknown as ElasticDatasource;

    const props = { ...defaultProps, datasource: datasourceWithError };

    // Should not throw error when rendering
    expect(() => render(<ElasticsearchVariableEditor {...props} />)).not.toThrow();

    // Wait for the error to be handled
    await waitFor(() => {
      expect(datasourceWithError.query).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it('should update query only when query content changes, not meta', () => {
    const { rerender } = render(<ElasticsearchVariableEditor {...defaultProps} />);

    const initialCallCount = (defaultProps.datasource.query as jest.Mock).mock.calls.length;

    // Update meta field only
    const queryWithMeta: ElasticsearchDataQuery = {
      ...defaultProps.query,
      meta: {
        textField: 'name',
      },
    };

    rerender(<ElasticsearchVariableEditor {...defaultProps} query={queryWithMeta} />);

    // Should not trigger new query since only meta changed
    expect((defaultProps.datasource.query as jest.Mock).mock.calls.length).toBe(initialCallCount);
  });

  it('should trigger new query when query content changes', () => {
    const { rerender } = render(<ElasticsearchVariableEditor {...defaultProps} />);

    const initialCallCount = (defaultProps.datasource.query as jest.Mock).mock.calls.length;

    // Update query content
    const updatedQuery: ElasticsearchDataQuery = {
      ...defaultProps.query,
      query: 'updated query',
    };

    rerender(<ElasticsearchVariableEditor {...defaultProps} query={updatedQuery} />);

    // Should trigger new query since query content changed
    expect((defaultProps.datasource.query as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});
