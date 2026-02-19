import { skipToken } from '@reduxjs/toolkit/query';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from 'test/test-utils';

import { store } from '@grafana/data';
import { config } from '@grafana/runtime';

import { DISMISS_STORAGE_KEY, QuotaLimitBanner } from './QuotaLimitBanner';

const mockUseGetUsageQuery = jest.fn();
jest.mock('@grafana/api-clients/rtkq/quotas/v0alpha1', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/quotas/v0alpha1'),
  useGetUsageQuery: (...args: unknown[]) => mockUseGetUsageQuery(...args),
}));

let mockIsFreeTier = false;
jest.mock('../../provisioning/utils/isFreeTierLicense', () => ({
  isFreeTierLicense: () => mockIsFreeTier,
}));

interface UsageData {
  usage: number;
  limit: number;
}

function mockQueries(dashboards: UsageData | 'loading' | 'error', folders: UsageData | 'loading' | 'error') {
  const toResult = (value: UsageData | 'loading' | 'error') => {
    if (value === 'loading') {
      return { data: undefined, isLoading: true, error: undefined };
    }
    if (value === 'error') {
      return { data: undefined, isLoading: false, error: new Error('fail') };
    }
    return { data: value, isLoading: false, error: undefined };
  };

  mockUseGetUsageQuery.mockImplementation((args: { group: string; resource: string } | typeof skipToken) => {
    if (args === skipToken) {
      return { data: undefined, isLoading: false, error: undefined };
    }
    if (args.group === 'dashboard.grafana.app') {
      return toResult(dashboards);
    }
    return toResult(folders);
  });
}

const errorAlert = { name: /hit your storage limits/i };
const warningAlert = { name: /nearing your storage limits/i };
// Alert's buttonContent button gets aria-label="Close alert" (hardcoded in Alert component)
const extensionButton = { name: /close alert/i };

describe('QuotaLimitBanner', () => {
  let previousFlag: boolean | undefined;

  beforeEach(() => {
    previousFlag = config.featureToggles.kubernetesUnifiedStorageQuotas;
    config.featureToggles.kubernetesUnifiedStorageQuotas = true;
    mockIsFreeTier = false;
    mockQueries({ usage: 100, limit: 1000 }, { usage: 100, limit: 1000 });
    store.delete(DISMISS_STORAGE_KEY);
  });

  afterEach(() => {
    config.featureToggles.kubernetesUnifiedStorageQuotas = previousFlag;
  });

  describe('renders nothing', () => {
    it('when feature flag is off', () => {
      config.featureToggles.kubernetesUnifiedStorageQuotas = false;
      const { container } = render(<QuotaLimitBanner />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when loading', () => {
      mockQueries('loading', 'loading');
      const { container } = render(<QuotaLimitBanner />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when both queries error', () => {
      mockQueries('error', 'error');
      const { container } = render(<QuotaLimitBanner />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when both resources are below threshold', () => {
      const { container } = render(<QuotaLimitBanner />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when limit is 0', () => {
      mockQueries({ usage: 100, limit: 0 }, { usage: 100, limit: 0 });
      const { container } = render(<QuotaLimitBanner />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('error alert', () => {
    it('shows when dashboards are at limit', () => {
      mockQueries({ usage: 1000, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = screen.getByRole('alert', errorAlert);
      expect(alert).toHaveTextContent(/created 1,000 of 1,000 dashboards \(100%\)/);
    });

    it('shows when folders are at limit', () => {
      mockQueries({ usage: 100, limit: 1000 }, { usage: 1000, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = screen.getByRole('alert', errorAlert);
      expect(alert).toHaveTextContent(/created 1,000 of 1,000 folders \(100%\)/);
    });

    it('shows both resources when both are at limit', () => {
      mockQueries({ usage: 1000, limit: 1000 }, { usage: 500, limit: 500 });
      render(<QuotaLimitBanner />);

      const alert = screen.getByRole('alert', errorAlert);
      expect(alert).toHaveTextContent(/created 1,000 of 1,000 dashboards \(100%\)/);
      expect(alert).toHaveTextContent(/created 500 of 500 folders \(100%\)/);
    });

    it('shows when one query errors but the other is at limit', () => {
      mockQueries({ usage: 1000, limit: 1000 }, 'error');
      render(<QuotaLimitBanner />);
      expect(screen.getByRole('alert', errorAlert)).toBeInTheDocument();
    });
  });

  describe('error and warning alerts', () => {
    it('shows separate alerts when dashboards nearing and folders at limit', () => {
      mockQueries({ usage: 850, limit: 1000 }, { usage: 1000, limit: 1000 });
      render(<QuotaLimitBanner />);

      const error = screen.getByRole('alert', errorAlert);
      expect(error).toHaveTextContent(/created 1,000 of 1,000 folders \(100%\)/);

      const warning = screen.getByRole('alert', warningAlert);
      expect(warning).toHaveTextContent(/created 850 of 1,000 dashboards \(85%\)/);
    });

    it('shows separate alerts when dashboards at limit and folders nearing', () => {
      mockQueries({ usage: 1000, limit: 1000 }, { usage: 850, limit: 1000 });
      render(<QuotaLimitBanner />);

      const error = screen.getByRole('alert', errorAlert);
      expect(error).toHaveTextContent(/created 1,000 of 1,000 dashboards \(100%\)/);

      const warning = screen.getByRole('alert', warningAlert);
      expect(warning).toHaveTextContent(/created 850 of 1,000 folders \(85%\)/);
    });
  });

  describe('warning alert', () => {
    it('shows when dashboards are nearing limit', () => {
      mockQueries({ usage: 850, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = screen.getByRole('alert', warningAlert);
      expect(alert).toHaveTextContent(/created 850 of 1,000 dashboards \(85%\)/);
      expect(screen.queryByRole('alert', errorAlert)).not.toBeInTheDocument();
    });

    it('shows when folders are nearing limit', () => {
      mockQueries({ usage: 100, limit: 1000 }, { usage: 850, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = screen.getByRole('alert', warningAlert);
      expect(alert).toHaveTextContent(/created 850 of 1,000 folders \(85%\)/);
      expect(screen.queryByRole('alert', errorAlert)).not.toBeInTheDocument();
    });

    it('shows both resources in one alert when both are nearing', () => {
      mockQueries({ usage: 850, limit: 1000 }, { usage: 900, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = screen.getByRole('alert', warningAlert);
      expect(alert).toHaveTextContent(/created 850 of 1,000 dashboards \(85%\)/);
      expect(alert).toHaveTextContent(/created 900 of 1,000 folders \(90%\)/);
      expect(screen.queryByRole('alert', errorAlert)).not.toBeInTheDocument();
    });
  });

  describe('dismiss', () => {
    it('hides warning when dismiss button is clicked', async () => {
      mockQueries({ usage: 850, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);
      expect(screen.getByRole('alert', warningAlert)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByRole('alert', warningAlert)).not.toBeInTheDocument();
    });

    it('persists dismissal to localStorage', async () => {
      mockQueries({ usage: 850, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);

      await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      const stored = store.getObject<Record<string, boolean>>(DISMISS_STORAGE_KEY);
      expect(stored).toEqual(expect.objectContaining({ dashboards: true }));
    });

    it('stays hidden when previously dismissed via localStorage', () => {
      store.setObject(DISMISS_STORAGE_KEY, { dashboards: true });
      mockQueries({ usage: 850, limit: 1000 }, { usage: 100, limit: 1000 });
      const { container } = render(<QuotaLimitBanner />);
      expect(container).toBeEmptyDOMElement();
    });

    it('dismissing dashboards does not hide folders', () => {
      store.setObject(DISMISS_STORAGE_KEY, { dashboards: true });
      mockQueries({ usage: 850, limit: 1000 }, { usage: 850, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = screen.getByRole('alert', warningAlert);
      expect(alert).toHaveTextContent(/created 850 of 1,000 folders/);
      expect(alert).not.toHaveTextContent(/dashboards/);
    });
  });

  describe('request quota extension', () => {
    it('shows button for paying customers', () => {
      mockQueries({ usage: 1000, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = screen.getByRole('alert', errorAlert);
      expect(within(alert).getByRole('button', extensionButton)).toBeInTheDocument();
    });

    it('hides button for free tier', () => {
      mockIsFreeTier = true;
      mockQueries({ usage: 1000, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = screen.getByRole('alert', errorAlert);
      expect(within(alert).queryByRole('button', extensionButton)).not.toBeInTheDocument();
    });

    it('shows button in each alert when both severities present', () => {
      mockQueries({ usage: 850, limit: 1000 }, { usage: 1000, limit: 1000 });
      render(<QuotaLimitBanner />);

      const error = screen.getByRole('alert', errorAlert);
      expect(within(error).getByRole('button', extensionButton)).toBeInTheDocument();

      const warning = screen.getByRole('alert', warningAlert);
      expect(within(warning).getByRole('button', extensionButton)).toBeInTheDocument();
    });
  });

  describe('queries', () => {
    it('passes correct args for dashboards and folders', () => {
      render(<QuotaLimitBanner />);
      expect(mockUseGetUsageQuery).toHaveBeenCalledWith({ group: 'dashboard.grafana.app', resource: 'dashboards' });
      expect(mockUseGetUsageQuery).toHaveBeenCalledWith({ group: 'folder.grafana.app', resource: 'folders' });
    });

    it('passes skipToken when feature flag is off', () => {
      config.featureToggles.kubernetesUnifiedStorageQuotas = false;
      render(<QuotaLimitBanner />);
      expect(mockUseGetUsageQuery).toHaveBeenCalledWith(skipToken);
    });
  });
});
