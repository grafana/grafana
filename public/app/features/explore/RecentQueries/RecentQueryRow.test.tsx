import { render, screen } from 'test/test-utils';

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
    queryDisplayTexts: ['up{job="grafana"}'],
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

  it('renders one line per query when the entry has multiple queries', () => {
    render(
      <RecentQueryRow {...defaultProps} queryDisplayTexts={['up{job="grafana"}', 'rate(errors[5m])', 'count()']} />
    );
    expect(screen.getByText('up{job="grafana"}')).toBeInTheDocument();
    expect(screen.getByText('rate(errors[5m])')).toBeInTheDocument();
    expect(screen.getByText('count()')).toBeInTheDocument();
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

  describe('save button (Cloud+Enterprise)', () => {
    it('shows save icon instead of star when onSaveQuery is provided', () => {
      render(<RecentQueryRow {...defaultProps} onSaveQuery={jest.fn()} />);
      expect(screen.getByRole('button', { name: /save query/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^star$/i })).not.toBeInTheDocument();
    });

    it('calls onSaveQuery when clicking the save button', async () => {
      const onSaveQuery = jest.fn();
      const { user } = render(<RecentQueryRow {...defaultProps} onSaveQuery={onSaveQuery} />);
      await user.click(screen.getByRole('button', { name: /save query/i }));
      expect(onSaveQuery).toHaveBeenCalledWith(mockQuery);
    });
  });

  describe('star tooltip (OSS)', () => {
    it('shows star button when onSaveQuery is not provided', () => {
      render(<RecentQueryRow {...defaultProps} />);
      expect(screen.getByRole('button', { name: /^star$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save query/i })).not.toBeInTheDocument();
    });

    it('shows tooltip when starring a query', async () => {
      const { user } = render(<RecentQueryRow {...defaultProps} />);
      await user.click(screen.getByRole('button', { name: /^star$/i }));

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText(/query starred/i)).toBeInTheDocument();
    });

    it('does not show tooltip when unstarring a query', async () => {
      const { user } = render(<RecentQueryRow {...defaultProps} query={starredQuery} />);
      await user.click(screen.getByRole('button', { name: /^unstar$/i }));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('does not show tooltip on initial render for already-starred query', () => {
      render(<RecentQueryRow {...defaultProps} query={starredQuery} />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
