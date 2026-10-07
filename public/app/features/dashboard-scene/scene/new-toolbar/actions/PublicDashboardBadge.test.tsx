import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

import { DashboardScene } from '../../DashboardScene';

import { PublicDashboardBadge } from './PublicDashboardBadge';

const mockUseGetPublicDashboardQuery = jest.fn();

jest.mock('app/features/dashboard/api/publicDashboardApi', () => ({
  useGetPublicDashboardQuery: (uid: string, options?: { skip?: boolean }) =>
    mockUseGetPublicDashboardQuery(uid, options),
}));

const PUBLIC_DASHBOARD = { uid: 'public-dashboard-1', isEnabled: true } as PublicDashboard;

function renderBadge({
  publicDashboardEnabled,
  publicDashboard,
  uid = 'dash-1',
}: {
  publicDashboardEnabled?: boolean;
  publicDashboard?: PublicDashboard;
  uid?: string;
}) {
  mockUseGetPublicDashboardQuery.mockReturnValue({ data: publicDashboard });

  const dashboard = new DashboardScene({ uid, title: 'hello', meta: { publicDashboardEnabled } });

  render(<PublicDashboardBadge dashboard={dashboard} />);
}

const badge = () => screen.queryByTestId(selectors.pages.Dashboard.DashNav.publicDashboardTag);

/** The `skip` option the component passed to useGetPublicDashboardQuery on the last render. */
const querySkipped = () => mockUseGetPublicDashboardQuery.mock.calls.at(-1)?.[1]?.skip;

describe('PublicDashboardBadge', () => {
  let originalPublicDashboardsEnabled: boolean;

  beforeAll(() => {
    originalPublicDashboardsEnabled = config.publicDashboardsEnabled;
    config.publicDashboardsEnabled = true;
  });

  afterAll(() => {
    config.publicDashboardsEnabled = originalPublicDashboardsEnabled;
  });

  afterEach(() => {
    mockUseGetPublicDashboardQuery.mockReset();
    setTestFlags({});
  });

  it('renders nothing when public dashboards are disabled', () => {
    config.publicDashboardsEnabled = false;
    renderBadge({ publicDashboardEnabled: true });
    config.publicDashboardsEnabled = true;

    expect(badge()).not.toBeInTheDocument();
  });

  it('renders nothing when the dashboard has no uid', () => {
    renderBadge({ publicDashboardEnabled: true, uid: '' });

    expect(badge()).not.toBeInTheDocument();
  });

  // relies on access.isPublic, and the API is consulted only when the field is absent.
  describe('with dashboards.publicDashboardBadgeFromApi disabled', () => {
    it('shows the badge from access.isPublic', () => {
      renderBadge({ publicDashboardEnabled: true });

      expect(badge()).toBeInTheDocument();
    });

    it('hides the badge from access.isPublic without asking the API', () => {
      renderBadge({ publicDashboardEnabled: false, publicDashboard: PUBLIC_DASHBOARD });

      expect(badge()).not.toBeInTheDocument();
      expect(querySkipped()).toBe(true);
    });

    it('falls back to the API when access.isPublic is absent', () => {
      renderBadge({ publicDashboardEnabled: undefined, publicDashboard: PUBLIC_DASHBOARD });

      expect(badge()).toBeInTheDocument();
      expect(querySkipped()).toBe(false);
    });

    it('hides the badge when access.isPublic is absent and the API has no public dashboard', () => {
      renderBadge({ publicDashboardEnabled: undefined });

      expect(badge()).not.toBeInTheDocument();
    });
  });

  // The public dashboard API is the source of truth, so it decouples the access.isPublic field.
  describe('with dashboards.publicDashboardBadgeFromApi enabled', () => {
    beforeEach(() => {
      setTestFlags({ [FlagKeys.DashboardsPublicDashboardBadgeFromApi]: true });
    });

    it('shows the badge for a public dashboard the API reports even though access.isPublic is false', () => {
      renderBadge({ publicDashboardEnabled: false, publicDashboard: PUBLIC_DASHBOARD });

      expect(badge()).toBeInTheDocument();
    });

    it('hides the badge when the API reports no public dashboard even though access.isPublic is true', () => {
      renderBadge({ publicDashboardEnabled: true });

      expect(badge()).not.toBeInTheDocument();
    });

    it('shows the badge from the API when access.isPublic is absent', () => {
      renderBadge({ publicDashboardEnabled: undefined, publicDashboard: PUBLIC_DASHBOARD });

      expect(badge()).toBeInTheDocument();
    });

    it('never skips the query', () => {
      renderBadge({ publicDashboardEnabled: false });

      expect(querySkipped()).toBe(false);
    });
  });
});
