import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataFrame, type DataQueryError, type QueryResultMetaNotice } from '@grafana/data';

import { StandardErrorsAndNoticesInspector } from './StandardErrorsAndNoticesInspector';

const mockUseAssistant = jest.fn().mockReturnValue({ isLoading: false, isAvailable: true });

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => mockUseAssistant(),
  OpenAssistantButton: ({ title, onClick }: { title: string; onClick?: () => void }) => (
    <button onClick={onClick}>{title}</button>
  ),
  createAssistantContextItem: jest.fn((type: string, params: { title: string; data: unknown }) => ({
    type,
    ...params,
  })),
}));

function frameWithNotices(notices: QueryResultMetaNotice[]): DataFrame {
  return { name: 'A', fields: [], length: 0, meta: { notices } } as DataFrame;
}

function setup(data: DataFrame[] = [], errors: DataQueryError[] = [], onClose?: () => void) {
  return render(<StandardErrorsAndNoticesInspector data={data} errors={errors} onClose={onClose} />);
}

describe('StandardErrorsAndNoticesInspector', () => {
  beforeEach(() => {
    mockUseAssistant.mockReturnValue({ isLoading: false, isAvailable: true });
  });

  it('does not render an Investigate with Assistant button when the assistant is unavailable', () => {
    mockUseAssistant.mockReturnValue({ isLoading: false, isAvailable: false });

    setup([], [{ message: 'Query blew up' }]);

    expect(screen.queryByRole('button', { name: 'Investigate with Assistant' })).not.toBeInTheDocument();
  });

  it('renders an Investigate with Assistant button per card when the assistant is available', () => {
    setup([frameWithNotices([{ severity: 'warning', text: 'one' }])], [{ message: 'Query blew up' }]);

    expect(screen.getAllByRole('button', { name: 'Investigate with Assistant' })).toHaveLength(2);
  });

  it('closes the inspector when Investigate with Assistant is clicked', async () => {
    const onClose = jest.fn();
    setup([], [{ message: 'Query blew up' }], onClose);

    await userEvent.click(screen.getByRole('button', { name: 'Investigate with Assistant' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('builds structured assistant context from the error/notice content', () => {
    const { createAssistantContextItem } = jest.requireMock('@grafana/assistant');
    createAssistantContextItem.mockClear();

    setup(
      [frameWithNotices([{ severity: 'warning', text: 'a cautionary thing', link: 'https://example.com/more' }])],
      [{ message: 'Query blew up', data: { message: 'upstream 500' } }]
    );

    expect(createAssistantContextItem).toHaveBeenCalledWith(
      'structured',
      expect.objectContaining({
        title: 'Query error details',
        data: expect.objectContaining({ severity: 'error' }),
      })
    );
    expect(createAssistantContextItem).toHaveBeenCalledWith(
      'structured',
      expect.objectContaining({
        title: 'Notice details',
        data: expect.objectContaining({
          severity: 'warning',
          content: 'a cautionary thing',
          link: 'https://example.com/more',
        }),
      })
    );
  });

  it('shows an empty state when there are no errors or notices', () => {
    setup();
    expect(screen.getByText('No errors or notices for this query.')).toBeInTheDocument();
  });

  it('renders a card per severity with its label', () => {
    setup(
      [
        frameWithNotices([
          { severity: 'info', text: 'An informational thing' },
          { severity: 'warning', text: 'A cautionary thing' },
        ]),
      ],
      [{ message: 'Query blew up', data: { message: 'upstream 500' } }]
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('sorts cards error > warning > info', () => {
    setup(
      [
        frameWithNotices([
          { severity: 'info', text: 'info note' },
          { severity: 'warning', text: 'warning note' },
        ]),
      ],
      [{ message: 'error note' }]
    );

    const errorLabel = screen.getByText('Error');
    const warningLabel = screen.getByText('Warning');
    const infoLabel = screen.getByText('Info');

    // Error comes before Warning, Warning before Info, in document order.
    expect(errorLabel.compareDocumentPosition(warningLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(warningLabel.compareDocumentPosition(infoLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('dedupes identical notices', () => {
    setup([
      frameWithNotices([
        { severity: 'warning', text: 'duplicate' },
        { severity: 'warning', text: 'duplicate' },
      ]),
    ]);

    expect(screen.getAllByText('duplicate')).toHaveLength(1);
  });

  it('renders notice text as markdown (links and bold)', () => {
    setup([
      frameWithNotices([{ severity: 'info', text: 'See [the docs](https://example.com/docs) and **note this**' }]),
    ]);

    const link = screen.getByRole('link', { name: 'the docs' });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(screen.getByText('note this').tagName.toLowerCase()).toBe('strong');
  });

  it('renders a "Learn more" link from notice.link', () => {
    setup([frameWithNotices([{ severity: 'info', text: 'has a link', link: 'https://example.com/more' }])]);

    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', 'https://example.com/more');
  });

  it('renders the raw error payload for errors', () => {
    setup([], [{ message: 'Query failed', data: { message: 'detailed upstream error' } }]);
    expect(screen.getByText(/detailed upstream error/)).toBeInTheDocument();
  });

  it('renders the error message above the raw payload', () => {
    setup([], [{ message: 'Query failed', data: { message: 'detailed upstream error' } }]);

    const message = screen.getByText('Query failed');
    const payload = screen.getByText(/detailed upstream error/);
    expect(message.compareDocumentPosition(payload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('falls back to the data message when the error has no top-level message', () => {
    setup([], [{ data: { message: 'only in data' } }]);
    expect(screen.getAllByText(/only in data/).length).toBeGreaterThanOrEqual(1);
  });

  it('provides a copy-to-clipboard button per card', () => {
    setup([
      frameWithNotices([
        { severity: 'warning', text: 'one' },
        { severity: 'info', text: 'two' },
      ]),
    ]);

    expect(screen.getAllByRole('button', { name: 'Copy to clipboard' })).toHaveLength(2);
  });
});
