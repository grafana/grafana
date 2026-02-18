import { skipToken } from '@reduxjs/toolkit/query';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { store } from '@grafana/data';
import { config } from '@grafana/runtime';

import { DISMISS_STORAGE_KEY, QuotaLimitBanner } from './QuotaLimitBanner';

// Mock the RTK Query hook while preserving generatedAPI for the rtkq index
const mockUseGetUsageQuery = jest.fn();
jest.mock('@grafana/api-clients/rtkq/quotas/v0alpha1', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/quotas/v0alpha1'),
  useGetUsageQuery: (...args: unknown[]) => mockUseGetUsageQuery(...args),
}));

// Mock isFreeTierLicense
let mockIsFreeTier = false;
jest.mock('../../provisioning/utils/isFreeTierLicense', () => ({
  isFreeTierLicense: () => mockIsFreeTier,
}));

const LOADING = { data: undefined, isLoading: true, error: undefined };
const ERROR = { data: undefined, isLoading: false, error: new Error('fail') };
const OK = { data: { usage: 100, limit: 1000 }, isLoading: false, error: undefined };
const NEARING = { data: { usage: 850, limit: 1000 }, isLoading: false, error: undefined };
const AT_LIMIT = { data: { usage: 1000, limit: 1000 }, isLoading: false, error: undefined };
const ZERO_LIMIT = { data: { usage: 100, limit: 0 }, isLoading: false, error: undefined };

type MockQueryResult = {
  data: { usage: number; limit: number } | undefined;
  isLoading: boolean;
  error: Error | undefined;
};

function mockQueries(dashboards: MockQueryResult, folders: MockQueryResult) {
  mockUseGetUsageQuery.mockImplementation((args: { group: string; resource: string } | typeof skipToken) => {
    if (args === skipToken) {
      return { data: undefined, isLoading: false, error: undefined };
    }
    if (args.group === 'dashboard.grafana.app') {
      return dashboards;
    }
    return folders;
  });
}

describe('QuotaLimitBanner', () => {
  let previousFlag: boolean | undefined;

  beforeEach(() => {
    previousFlag = config.featureToggles.kubernetesUnifiedStorageQuotas;
    config.featureToggles.kubernetesUnifiedStorageQuotas = true;
    mockIsFreeTier = false;
    mockQueries(OK, OK);
    store.delete(DISMISS_STORAGE_KEY);
  });

  afterEach(() => {
    config.featureToggles.kubernetesUnifiedStorageQuotas = previousFlag;
  });

  it('renders nothing when feature flag is off', () => {
    config.featureToggles.kubernetesUnifiedStorageQuotas = false;
    const { container } = render(<QuotaLimitBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when loading', () => {
    mockQueries(LOADING, LOADING);
    const { container } = render(<QuotaLimitBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when both queries error', () => {
    mockQueries(ERROR, ERROR);
    const { container } = render(<QuotaLimitBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when both resources are below threshold', () => {
    mockQueries(OK, OK);
    const { container } = render(<QuotaLimitBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when limit is 0', () => {
    mockQueries(ZERO_LIMIT, ZERO_LIMIT);
    const { container } = render(<QuotaLimitBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders warning when dashboards are nearing limit', () => {
    mockQueries(NEARING, OK);
    render(<QuotaLimitBanner />);
    expect(screen.getByText(/nearing your storage limits/i)).toBeInTheDocument();
    expect(screen.getByText(/created 850 of 1,000 dashboards \(85%\)/)).toBeInTheDocument();
  });

  it('renders warning when folders are nearing limit', () => {
    mockQueries(OK, NEARING);
    render(<QuotaLimitBanner />);
    expect(screen.getByText(/nearing your storage limits/i)).toBeInTheDocument();
    expect(screen.getByText(/created 850 of 1,000 folders \(85%\)/)).toBeInTheDocument();
  });

  it('renders error when dashboards are at limit', () => {
    mockQueries(AT_LIMIT, OK);
    render(<QuotaLimitBanner />);
    expect(screen.getByText(/hit your storage limits/i)).toBeInTheDocument();
  });

  it('shows both resources when both are affected', () => {
    mockQueries(NEARING, AT_LIMIT);
    render(<QuotaLimitBanner />);
    // Worst state wins — error severity
    expect(screen.getByText(/hit your storage limits/i)).toBeInTheDocument();
    expect(screen.getByText(/created 850 of 1,000 dashboards \(85%\)/)).toBeInTheDocument();
    expect(screen.getByText(/created 1,000 of 1,000 folders \(100%\)/)).toBeInTheDocument();
  });

  it('uses error severity when any resource is at limit', () => {
    mockQueries(NEARING, AT_LIMIT);
    render(<QuotaLimitBanner />);
    expect(screen.getByText(/hit your/i)).toBeInTheDocument();
  });

  it('shows "Request quota extension" button for paying customers', () => {
    mockIsFreeTier = false;
    mockQueries(AT_LIMIT, OK);
    render(<QuotaLimitBanner />);
    expect(screen.getByText(/request quota extension/i)).toBeInTheDocument();
  });

  it('shows both X close and extension button for paying customers when nearing limit', () => {
    mockIsFreeTier = false;
    mockQueries(NEARING, OK);
    render(<QuotaLimitBanner />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    expect(screen.getByText(/request quota extension/i)).toBeInTheDocument();
  });

  it('does not show close button when at limit (error severity)', () => {
    mockQueries(AT_LIMIT, OK);
    render(<QuotaLimitBanner />);
    expect(screen.getByText(/hit your storage limits/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('does not show "Request quota extension" button for free tier users', () => {
    mockIsFreeTier = true;
    mockQueries(AT_LIMIT, OK);
    render(<QuotaLimitBanner />);
    expect(screen.queryByText(/request quota extension/i)).not.toBeInTheDocument();
  });

  it('dismisses the banner when close button is clicked (free tier)', async () => {
    mockIsFreeTier = true;
    mockQueries(NEARING, OK);
    render(<QuotaLimitBanner />);
    expect(screen.getByText(/nearing your storage limits/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText(/nearing your storage limits/i)).not.toBeInTheDocument();
  });

  it('dismisses the banner when close button is clicked (paying)', async () => {
    mockIsFreeTier = false;
    mockQueries(NEARING, OK);
    render(<QuotaLimitBanner />);
    expect(screen.getByText(/nearing your storage limits/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText(/nearing your storage limits/i)).not.toBeInTheDocument();
  });

  it('queries both dashboards and folders', () => {
    render(<QuotaLimitBanner />);
    expect(mockUseGetUsageQuery).toHaveBeenCalledWith({ group: 'dashboard.grafana.app', resource: 'dashboards' });
    expect(mockUseGetUsageQuery).toHaveBeenCalledWith({ group: 'folder.grafana.app', resource: 'folders' });
  });

  it('passes skipToken when feature flag is off', () => {
    config.featureToggles.kubernetesUnifiedStorageQuotas = false;
    render(<QuotaLimitBanner />);
    expect(mockUseGetUsageQuery).toHaveBeenCalledWith(skipToken);
  });

  it('still shows banner when one query errors but other has data', () => {
    mockQueries(AT_LIMIT, ERROR);
    render(<QuotaLimitBanner />);
    expect(screen.getByText(/hit your storage limits/i)).toBeInTheDocument();
  });

  it('persists dismissal to local storage', async () => {
    mockIsFreeTier = true;
    mockQueries(NEARING, OK);
    render(<QuotaLimitBanner />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    const stored = store.getObject<Record<string, boolean>>(DISMISS_STORAGE_KEY);
    expect(stored).toEqual(expect.objectContaining({ dashboards: true }));
  });

  it('stays hidden when previously dismissed via local storage', () => {
    store.setObject(DISMISS_STORAGE_KEY, { dashboards: true });
    mockQueries(NEARING, OK);
    const { container } = render(<QuotaLimitBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('dismissing dashboards warning does not hide folders warning', () => {
    store.setObject(DISMISS_STORAGE_KEY, { dashboards: true });
    mockQueries(NEARING, NEARING);
    render(<QuotaLimitBanner />);
    expect(screen.queryByText(/created 850 of 1,000 dashboards/)).not.toBeInTheDocument();
    expect(screen.getByText(/created 850 of 1,000 folders/)).toBeInTheDocument();
  });
});
