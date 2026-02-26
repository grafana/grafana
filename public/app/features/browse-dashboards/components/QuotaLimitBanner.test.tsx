import { HttpResponse, http } from 'msw';
import { render, screen, testWithFeatureToggles, waitFor, within } from 'test/test-utils';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { store } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { QUOTAS_USAGE_URL } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { DISMISS_STORAGE_KEY, QuotaLimitBanner } from './QuotaLimitBanner';

setBackendSrv(backendSrv);
setupMockServer();

let mockIsFreeTier = false;
jest.mock('../../provisioning/utils/isFreeTierLicense', () => ({
  isFreeTierLicense: () => mockIsFreeTier,
}));

function usageResponse(group: string | null, resource: string | null, data: { usage: number; limit: number }) {
  return {
    apiVersion: 'quotas.grafana.app/v0alpha1',
    kind: 'GetUsageResponse',
    group,
    resource,
    namespace: 'default',
    ...data,
  };
}

function mockUsage(dashboards: { usage: number; limit: number }, folders: { usage: number; limit: number }) {
  server.use(
    http.get(QUOTAS_USAGE_URL, ({ request }) => {
      const url = new URL(request.url);
      const group = url.searchParams.get('group');
      const resource = url.searchParams.get('resource');
      const data = group === DASHBOARD_API_GROUP ? dashboards : folders;

      return HttpResponse.json(usageResponse(group, resource, data));
    })
  );
}

function mockErrorForResource(errorGroup?: string, successData?: { usage: number; limit: number }) {
  server.use(
    http.get(QUOTAS_USAGE_URL, ({ request }) => {
      const url = new URL(request.url);
      const group = url.searchParams.get('group');
      const resource = url.searchParams.get('resource');

      if (!errorGroup || group === errorGroup) {
        return HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 });
      }

      return HttpResponse.json(usageResponse(group, resource, successData!));
    })
  );
}

async function expectNoAlert() {
  await waitFor(() => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
}

const errorAlert = { name: /hit your storage limits/i };
const warningAlert = { name: /nearing your storage limits/i };
// Alert's buttonContent button gets aria-label="Close alert" (hardcoded in Alert component)
const extensionButton = { name: /close alert/i };

describe('QuotaLimitBanner', () => {
  testWithFeatureToggles({ enable: ['kubernetesUnifiedStorageQuotas'] });

  beforeEach(() => {
    mockIsFreeTier = false;
    store.delete(DISMISS_STORAGE_KEY);
  });

  describe('renders nothing', () => {
    describe('when feature flag is off', () => {
      testWithFeatureToggles({ disable: ['kubernetesUnifiedStorageQuotas'] });

      it('renders nothing', async () => {
        render(<QuotaLimitBanner />);
        await expectNoAlert();
      });
    });

    it('when both queries error', async () => {
      mockErrorForResource();
      render(<QuotaLimitBanner />);
      await expectNoAlert();
    });

    it('when both resources are below threshold', async () => {
      render(<QuotaLimitBanner />);
      await expectNoAlert();
    });

    it('when limit is 0', async () => {
      mockUsage({ usage: 100, limit: 0 }, { usage: 100, limit: 0 });
      render(<QuotaLimitBanner />);
      await expectNoAlert();
    });
  });

  describe('error alert', () => {
    it('shows when dashboards are at limit', async () => {
      mockUsage({ usage: 1000, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = await screen.findByRole('alert', errorAlert);
      expect(alert).toHaveTextContent(/created 1,000 of 1,000 dashboards \(100%\)/);
    });

    it('shows when folders are at limit', async () => {
      mockUsage({ usage: 100, limit: 1000 }, { usage: 1000, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = await screen.findByRole('alert', errorAlert);
      expect(alert).toHaveTextContent(/created 1,000 of 1,000 folders \(100%\)/);
    });

    it('shows both resources when both are at limit', async () => {
      mockUsage({ usage: 1000, limit: 1000 }, { usage: 500, limit: 500 });
      render(<QuotaLimitBanner />);

      const alert = await screen.findByRole('alert', errorAlert);
      expect(alert).toHaveTextContent(/created 1,000 of 1,000 dashboards \(100%\)/);
      expect(alert).toHaveTextContent(/created 500 of 500 folders \(100%\)/);
    });

    it('shows when one query errors but the other is at limit', async () => {
      mockErrorForResource(FOLDER_API_GROUP, { usage: 1000, limit: 1000 });
      render(<QuotaLimitBanner />);
      expect(await screen.findByRole('alert', errorAlert)).toBeInTheDocument();
    });
  });

  describe('error and warning alerts', () => {
    it('shows separate alerts when dashboards nearing and folders at limit', async () => {
      mockUsage({ usage: 850, limit: 1000 }, { usage: 1000, limit: 1000 });
      render(<QuotaLimitBanner />);

      const error = await screen.findByRole('alert', errorAlert);
      expect(error).toHaveTextContent(/created 1,000 of 1,000 folders \(100%\)/);

      const warning = screen.getByRole('alert', warningAlert);
      expect(warning).toHaveTextContent(/created 850 of 1,000 dashboards \(85%\)/);
    });

    it('shows separate alerts when dashboards at limit and folders nearing', async () => {
      mockUsage({ usage: 1000, limit: 1000 }, { usage: 850, limit: 1000 });
      render(<QuotaLimitBanner />);

      const error = await screen.findByRole('alert', errorAlert);
      expect(error).toHaveTextContent(/created 1,000 of 1,000 dashboards \(100%\)/);

      const warning = screen.getByRole('alert', warningAlert);
      expect(warning).toHaveTextContent(/created 850 of 1,000 folders \(85%\)/);
    });
  });

  describe('warning alert', () => {
    it('shows when dashboards are nearing limit', async () => {
      mockUsage({ usage: 850, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = await screen.findByRole('alert', warningAlert);
      expect(alert).toHaveTextContent(/created 850 of 1,000 dashboards \(85%\)/);
      expect(screen.queryByRole('alert', errorAlert)).not.toBeInTheDocument();
    });

    it('shows when folders are nearing limit', async () => {
      mockUsage({ usage: 100, limit: 1000 }, { usage: 850, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = await screen.findByRole('alert', warningAlert);
      expect(alert).toHaveTextContent(/created 850 of 1,000 folders \(85%\)/);
      expect(screen.queryByRole('alert', errorAlert)).not.toBeInTheDocument();
    });

    it('shows both resources in one alert when both are nearing', async () => {
      mockUsage({ usage: 850, limit: 1000 }, { usage: 900, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = await screen.findByRole('alert', warningAlert);
      expect(alert).toHaveTextContent(/created 850 of 1,000 dashboards \(85%\)/);
      expect(alert).toHaveTextContent(/created 900 of 1,000 folders \(90%\)/);
      expect(screen.queryByRole('alert', errorAlert)).not.toBeInTheDocument();
    });
  });

  describe('dismiss', () => {
    it('hides warning when dismiss button is clicked', async () => {
      mockUsage({ usage: 850, limit: 1000 }, { usage: 100, limit: 1000 });
      const { user } = render(<QuotaLimitBanner />);
      expect(await screen.findByRole('alert', warningAlert)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByRole('alert', warningAlert)).not.toBeInTheDocument();
    });

    it('persists dismissal to localStorage', async () => {
      mockUsage({ usage: 850, limit: 1000 }, { usage: 100, limit: 1000 });
      const { user } = render(<QuotaLimitBanner />);
      expect(await screen.findByRole('alert', warningAlert)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      const stored = store.getObject<Record<string, boolean>>(DISMISS_STORAGE_KEY);
      expect(stored).toEqual(expect.objectContaining({ dashboards: true }));
    });

    it('stays hidden when previously dismissed via localStorage', async () => {
      store.setObject(DISMISS_STORAGE_KEY, { dashboards: true });
      mockUsage({ usage: 850, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('dismissing dashboards does not hide folders', async () => {
      store.setObject(DISMISS_STORAGE_KEY, { dashboards: true });
      mockUsage({ usage: 850, limit: 1000 }, { usage: 850, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = await screen.findByRole('alert', warningAlert);
      expect(alert).toHaveTextContent(/created 850 of 1,000 folders/);
      expect(alert).not.toHaveTextContent(/dashboards/);
    });
  });

  describe('request quota extension', () => {
    it('shows button for paying customers', async () => {
      mockUsage({ usage: 1000, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = await screen.findByRole('alert', errorAlert);
      expect(within(alert).getByRole('button', extensionButton)).toBeInTheDocument();
    });

    it('hides button for free tier', async () => {
      mockIsFreeTier = true;
      mockUsage({ usage: 1000, limit: 1000 }, { usage: 100, limit: 1000 });
      render(<QuotaLimitBanner />);

      const alert = await screen.findByRole('alert', errorAlert);
      expect(within(alert).queryByRole('button', extensionButton)).not.toBeInTheDocument();
    });

    it('shows button in each alert when both severities present', async () => {
      mockUsage({ usage: 850, limit: 1000 }, { usage: 1000, limit: 1000 });
      render(<QuotaLimitBanner />);

      const error = await screen.findByRole('alert', errorAlert);
      expect(within(error).getByRole('button', extensionButton)).toBeInTheDocument();

      const warning = screen.getByRole('alert', warningAlert);
      expect(within(warning).getByRole('button', extensionButton)).toBeInTheDocument();
    });
  });
});
