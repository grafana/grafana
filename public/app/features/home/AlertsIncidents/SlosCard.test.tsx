import { render, screen } from 'test/test-utils';

import { getBackendSrv } from '@grafana/runtime';

import { fetchSlos, SlosCard } from './SlosCard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const mockGetBackendSrv = jest.mocked(getBackendSrv);
const get = jest.fn();

beforeEach(() => {
  get.mockReset();
  mockGetBackendSrv.mockReturnValue({ get } as unknown as ReturnType<typeof getBackendSrv>);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SlosCard', () => {
  it('renders worst-case availability, error budget and an at-risk pill', async () => {
    get.mockResolvedValue({
      slos: [
        { status: { availabilityPercent: 99.95, errorBudgetRemainingPercent: 40, burning: false } },
        { status: { availabilityPercent: 99.5, errorBudgetRemainingPercent: 10, burning: true } },
      ],
    });

    render(<SlosCard />);

    expect(await screen.findByText('99.50%')).toBeInTheDocument();
    expect(screen.getByText('30-day availability')).toBeInTheDocument();
    expect(screen.getByText('Error budget 10% remaining')).toBeInTheDocument();
    expect(screen.getByText('1 at risk')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 SLOs at risk')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open slos/i })).toHaveAttribute('href', '/a/grafana-slo-app/manage-slos');
  });

  it('shows a Healthy pill and an all-ok row when nothing is burning', async () => {
    get.mockResolvedValue({
      slos: [{ status: { availabilityPercent: 99.99, errorBudgetRemainingPercent: 80, burning: false } }],
    });

    render(<SlosCard />);

    expect(await screen.findByText('99.99%')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('All SLOs healthy')).toBeInTheDocument();
  });

  it('shows the empty state when there are no SLOs', async () => {
    get.mockResolvedValue({ slos: [] });

    render(<SlosCard />);

    expect(await screen.findByText('No SLOs defined.')).toBeInTheDocument();
    expect(screen.queryByText('30-day availability')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the resource request fails', async () => {
    get.mockRejectedValue(new Error('boom'));

    render(<SlosCard />);

    expect(await screen.findByText('Could not load SLOs')).toBeInTheDocument();
  });
});

describe('fetchSlos', () => {
  it('derives worst-case numbers and at-risk count, ignoring statusless entries', async () => {
    get.mockResolvedValue({
      slos: [
        { status: { availabilityPercent: 99.9, errorBudgetRemainingPercent: 50, burning: false } },
        { status: { availabilityPercent: 99.2, errorBudgetRemainingPercent: 0, burning: true } },
        {}, // no status: excluded from the min/at-risk reductions, but still counts toward total
      ],
    });

    await expect(fetchSlos()).resolves.toEqual({ availability: 99.2, errorBudgetPct: 0, atRisk: 1, total: 3 });
  });

  it('defaults to 100% when no SLO carries a status', async () => {
    get.mockResolvedValue({ slos: [{}, {}] });

    await expect(fetchSlos()).resolves.toEqual({ availability: 100, errorBudgetPct: 100, atRisk: 0, total: 2 });
  });
});
