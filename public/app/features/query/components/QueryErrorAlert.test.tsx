import { render, screen } from '@testing-library/react';

import { type DataQueryError } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { QueryErrorAlert } from './QueryErrorAlert';

const mockUseAssistant = jest.fn().mockReturnValue({ isLoading: false, isAvailable: true });

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => mockUseAssistant(),
  useProvidePageContext: jest.fn(),
  OpenAssistantButton: ({ title }: { title: string }) => <button>{title}</button>,
  createAssistantContextItem: jest.fn((type: string, params: { title: string; data: unknown }) => ({
    type,
    ...params,
  })),
}));

describe('QueryErrorAlert', () => {
  beforeEach(() => {
    mockUseAssistant.mockReturnValue({ isLoading: false, isAvailable: true });
  });

  it('should not render the assistant button when assistant is not available', () => {
    mockUseAssistant.mockReturnValue({ isLoading: false, isAvailable: false });

    const error: DataQueryError = { message: 'Some error' };

    render(<QueryErrorAlert error={error} />);

    expect(screen.getByText('Some error')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fix with Assistant' })).not.toBeInTheDocument();
  });

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

  describe('soft-block errors', () => {
    const READABLE =
      'query range 2d exceeds the soft limit of 1d. Reduce the time range to 1d or less, or continue by retrying with a reason.';
    const softBlockMessage =
      `${READABLE} Confirm with the user before retrying. [guardrail_soft_block] ` +
      '{"code":"guardrail_soft_block","token":"abc.def"}' +
      '\n(Trace ID: 64a1bc6c40f7b9e12eb2153d1112d952)';

    it('renders the SoftBlockPrompt when onSoftBlockContinue is provided, without the trailer/JSON', () => {
      const error: DataQueryError = { message: softBlockMessage };

      render(<QueryErrorAlert error={error} onSoftBlockContinue={jest.fn()} />);

      expect(screen.getByText('Query paused by a guardrail')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      // The readable text is shown, but the machine-readable trailer/JSON is not.
      expect(screen.getByText(/query range 2d exceeds the soft limit of 1d/)).toBeInTheDocument();
      expect(screen.queryByText(/guardrail_soft_block/)).not.toBeInTheDocument();
      expect(screen.queryByText(/abc\.def/)).not.toBeInTheDocument();
      // The trailing Trace ID line is preserved.
      expect(screen.getByText(/64a1bc6c40f7b9e12eb2153d1112d952/)).toBeInTheDocument();
    });

    it('renders the plain alert with trailer stripped and no Continue/reason UI when the prop is absent', () => {
      const error: DataQueryError = { message: softBlockMessage };

      render(<QueryErrorAlert error={error} />);

      expect(screen.getByText(/query range 2d exceeds the soft limit of 1d/)).toBeInTheDocument();
      expect(screen.queryByText(/guardrail_soft_block/)).not.toBeInTheDocument();
      expect(screen.queryByText(/abc\.def/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByText('Query paused by a guardrail')).not.toBeInTheDocument();
      // The trailing Trace ID line is still displayed.
      expect(screen.getByText(/64a1bc6c40f7b9e12eb2153d1112d952/)).toBeInTheDocument();
    });

    it('renders a non-soft-block error unchanged even when onSoftBlockContinue is provided', () => {
      const error: DataQueryError = { message: 'Something went wrong' };

      render(<QueryErrorAlert error={error} onSoftBlockContinue={jest.fn()} />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
      expect(screen.queryByText('Query paused by a guardrail')).not.toBeInTheDocument();
    });
  });
});
