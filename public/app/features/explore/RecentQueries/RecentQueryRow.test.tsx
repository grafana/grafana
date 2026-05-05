import { render, screen, within } from 'test/test-utils';

import { type RichHistoryQuery } from 'app/types/explore';

import { RecentQueryRow } from './RecentQueryRow';

jest.mock('@grafana/data', () => {
  const original = jest.requireActual('@grafana/data');
  return {
    ...original,
    dateTimeFormat: (_dateInUtc: number, opts?: { format?: string }) => {
      if (opts?.format === 'MMM D, YYYY') {
        return 'Jan 3, 2025';
      }
      return 'mocked-date';
    },
  };
});

const mockQuery: RichHistoryQuery = {
  id: 'query-1',
  createdAt: 1735862400000,
  datasourceUid: 'ds-uid-1',
  datasourceName: 'Prometheus',
  starred: false,
  comment: '',
  queries: [{ refId: 'A' }],
};

const starredQuery: RichHistoryQuery = {
  ...mockQuery,
  id: 'query-2',
  starred: true,
};

describe('RecentQueryRow', () => {
  const defaultProps = {
    query: mockQuery,
    queryDisplayText: 'up{job="grafana"}',
    onSelectQuery: jest.fn(),
    onStarQuery: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders datasource name', () => {
    render(<RecentQueryRow {...defaultProps} />);
    expect(screen.getByText('Prometheus')).toBeInTheDocument();
  });

  it('renders formatted date', () => {
    render(<RecentQueryRow {...defaultProps} />);
    expect(screen.getByText('Jan 3, 2025')).toBeInTheDocument();
  });

  it('renders query display text', () => {
    render(<RecentQueryRow {...defaultProps} />);
    expect(screen.getByText('up{job="grafana"}')).toBeInTheDocument();
  });

  it('renders datasource icon with fallback when no logo provided', () => {
    render(<RecentQueryRow {...defaultProps} />);
    const img = screen.getByAltText('Prometheus');
    expect(img).toBeInTheDocument();
    // SVG imports are mocked by Jest's moduleNameMapper
    expect(img).toHaveAttribute('src');
  });

  it('renders datasource icon with provided logo', () => {
    render(<RecentQueryRow {...defaultProps} datasourceLogo="/img/prometheus.svg" />);
    const img = screen.getByAltText('Prometheus');
    expect(img).toHaveAttribute('src', '/img/prometheus.svg');
  });

  it('renders Select query button', () => {
    render(<RecentQueryRow {...defaultProps} />);
    expect(screen.getByRole('button', { name: /select query/i })).toBeInTheDocument();
  });

  it('calls onSelectQuery when clicking the Select query button', async () => {
    const onSelectQuery = jest.fn();
    const { user } = render(<RecentQueryRow {...defaultProps} onSelectQuery={onSelectQuery} />);
    await user.click(screen.getByRole('button', { name: /select query/i }));
    expect(onSelectQuery).toHaveBeenCalledWith(mockQuery);
  });

  describe('star button', () => {
    it('shows star icon when query is not starred', () => {
      render(<RecentQueryRow {...defaultProps} />);
      expect(screen.getByRole('button', { name: /^star$/i })).toBeInTheDocument();
    });

    it('shows filled star icon when query is starred', () => {
      render(<RecentQueryRow {...defaultProps} query={starredQuery} />);
      expect(screen.getByRole('button', { name: /^unstar$/i })).toBeInTheDocument();
    });

    it('calls onStarQuery with id and true when starring', async () => {
      const onStarQuery = jest.fn();
      const { user } = render(<RecentQueryRow {...defaultProps} onStarQuery={onStarQuery} />);
      await user.click(screen.getByRole('button', { name: /^star$/i }));
      expect(onStarQuery).toHaveBeenCalledWith('query-1', true);
    });

    it('calls onStarQuery with id and false when unstarring', async () => {
      const onStarQuery = jest.fn();
      const { user } = render(<RecentQueryRow {...defaultProps} query={starredQuery} onStarQuery={onStarQuery} />);
      await user.click(screen.getByRole('button', { name: /^unstar$/i }));
      expect(onStarQuery).toHaveBeenCalledWith('query-2', false);
    });
  });

  describe('star tooltip', () => {
    it('shows tooltip with save link when starring a query', async () => {
      const onSaveQuery = jest.fn();
      const { user } = render(<RecentQueryRow {...defaultProps} onSaveQuery={onSaveQuery} />);

      await user.click(screen.getByRole('button', { name: /^star$/i }));

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText(/query starred/i)).toBeInTheDocument();
      expect(screen.getByText(/save this query/i)).toBeInTheDocument();
    });

    it('does not show tooltip when unstarring a query', async () => {
      const onSaveQuery = jest.fn();
      const { user } = render(<RecentQueryRow {...defaultProps} query={starredQuery} onSaveQuery={onSaveQuery} />);

      await user.click(screen.getByRole('button', { name: /^unstar$/i }));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('does not show tooltip on initial render for already-starred query', () => {
      render(<RecentQueryRow {...defaultProps} query={starredQuery} onSaveQuery={jest.fn()} />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('calls onSaveQuery when clicking the save link in tooltip', async () => {
      const onSaveQuery = jest.fn();
      const { user } = render(<RecentQueryRow {...defaultProps} onSaveQuery={onSaveQuery} />);

      await user.click(screen.getByRole('button', { name: /^star$/i }));

      const tooltip = screen.getByRole('tooltip');
      const saveLink = within(tooltip).getByText(/save this query/i);
      await user.click(saveLink);

      expect(onSaveQuery).toHaveBeenCalledWith(mockQuery);
    });

    it('hides tooltip after clicking the save link', async () => {
      const onSaveQuery = jest.fn();
      const { user } = render(<RecentQueryRow {...defaultProps} onSaveQuery={onSaveQuery} />);

      await user.click(screen.getByRole('button', { name: /^star$/i }));
      const tooltip = screen.getByRole('tooltip');
      const saveLink = within(tooltip).getByText(/save this query/i);
      await user.click(saveLink);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('does not render save link when onSaveQuery is not provided', async () => {
      const { user } = render(<RecentQueryRow {...defaultProps} />);
      await user.click(screen.getByRole('button', { name: /^star$/i }));

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.queryByText(/save this query/i)).not.toBeInTheDocument();
    });
  });
});
