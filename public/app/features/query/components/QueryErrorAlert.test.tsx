import { render, screen } from '@testing-library/react';

import { DataQueryError } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { QueryErrorAlert } from './QueryErrorAlert';

jest.mock('@grafana/assistant', () => ({
  OpenAssistantButton: ({ title }: { title: string }) => <button>{title}</button>,
  createAssistantContextItem: jest.fn((type: string, params: { title: string; data: unknown }) => ({
    type,
    ...params,
  })),
}));

describe('QueryErrorAlert', () => {
  it('should render the error message', () => {
    const error: DataQueryError = { message: 'Something went wrong' };

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should fall back to data.message when message is not set', () => {
    const error: DataQueryError = { data: { message: 'Data level error' } };

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByText('Data level error')).toBeInTheDocument();
  });

  it('should show default message when no message is available', () => {
    const error: DataQueryError = {};

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByText('Query error')).toBeInTheDocument();
  });

  it('should render the trace ID when present', () => {
    const error: DataQueryError = { message: 'Error', traceId: 'abc123' };

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it('should render the Fix with Assistant button', () => {
    const error: DataQueryError = { message: 'Some error' };

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByRole('button', { name: 'Fix with Assistant' })).toBeInTheDocument();
  });

  it('should pass original query to assistant context when provided', () => {
    const { createAssistantContextItem } = jest.requireMock('@grafana/assistant');
    createAssistantContextItem.mockClear();

    const error: DataQueryError = { message: 'Error' };
    const query: DataQuery = { refId: 'A' };

    render(<QueryErrorAlert error={error} query={query} />);

    expect(createAssistantContextItem).toHaveBeenCalledWith('structured', {
      title: 'Original query',
      data: query,
    });
  });

  it('should not pass query context when query is not provided', () => {
    const { createAssistantContextItem } = jest.requireMock('@grafana/assistant');
    createAssistantContextItem.mockClear();

    const error: DataQueryError = { message: 'Error' };

    render(<QueryErrorAlert error={error} />);

    // Should only be called once for the error details, not for the query
    expect(createAssistantContextItem).toHaveBeenCalledTimes(1);
    expect(createAssistantContextItem).toHaveBeenCalledWith(
      'structured',
      expect.objectContaining({ title: 'Query error details' })
    );
  });
});
