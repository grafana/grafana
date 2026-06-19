import { render, screen } from '@testing-library/react';

import { type DataFrame, type DataQueryError, type QueryResultMetaNotice } from '@grafana/data';
import { type PrometheusDatasource } from '@grafana/prometheus';

import { ErrorsAndNoticesInspector } from './ErrorsAndNoticesInspector';

function frameWithNotices(notices: QueryResultMetaNotice[]): DataFrame {
  return { name: 'A', fields: [], length: 0, meta: { notices } } as DataFrame;
}

function setup(data: DataFrame[] = [], errors: DataQueryError[] = []) {
  return render(<ErrorsAndNoticesInspector datasource={{} as PrometheusDatasource} data={data} errors={errors} />);
}

describe('ErrorsAndNoticesInspector', () => {
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
