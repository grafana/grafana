import { screen } from '@testing-library/react';
import { type JSX } from 'react';
import { render } from 'test/test-utils';

import { SceneTimeRange } from '@grafana/scenes';
import { DashboardRoutes } from 'app/types/dashboard';

import { DashboardScene } from '../scene/DashboardScene';

import { SuggestedDashboardsBanner } from './SuggestedDashboardsBanner';

jest.mock('app/features/datasources/components/SuggestedDashboardsLoader', () => ({
  SuggestedDashboardsLoader: ({ children }: { children: (props: Record<string, unknown>) => JSX.Element }) =>
    children({ fetchStatus: 'idle', hasDashboards: false, triggerFetch: jest.fn(), openModal: jest.fn() }),
}));

function buildTestDashboard() {
  return new DashboardScene({
    title: 'My cool dashboard',
    uid: 'my-dash-uid',
    $timeRange: new SceneTimeRange({}),
  });
}

function renderBanner(route: string, initialEntry: string) {
  return render(<SuggestedDashboardsBanner route={route} dashboard={buildTestDashboard()} />, {
    historyOptions: { initialEntries: [initialEntry] },
  });
}

describe('SuggestedDashboardsBanner', () => {
  it('should render the banner when route is Template and URL params are present', () => {
    renderBanner(
      DashboardRoutes.Template,
      '/dashboard/templates/my-dash-uid?suggestedDashboardBanner=true&datasource=ds1'
    );

    expect(screen.getByText(/You are viewing/)).toBeInTheDocument();
    expect(screen.getByText(/other suggested dashboards/)).toBeInTheDocument();
    expect(screen.getByText(/create one from scratch/)).toBeInTheDocument();
  });

  it('should NOT render the banner on a normal route', () => {
    renderBanner(DashboardRoutes.Normal, '/d/my-dash-uid?suggestedDashboardBanner=true&datasource=ds1');

    expect(screen.queryByText(/You are viewing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/other suggested dashboards/)).not.toBeInTheDocument();
    expect(screen.queryByText(/create one from scratch/)).not.toBeInTheDocument();
  });

  it('should NOT render the banner without suggestedDashboardBanner param', () => {
    renderBanner(DashboardRoutes.Template, '/dashboard/templates/my-dash-uid?datasource=ds1');

    expect(screen.queryByText(/You are viewing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/other suggested dashboards/)).not.toBeInTheDocument();
    expect(screen.queryByText(/create one from scratch/)).not.toBeInTheDocument();
  });

  it('should NOT render the banner without datasource param', () => {
    renderBanner(DashboardRoutes.Template, '/dashboard/templates/my-dash-uid?suggestedDashboardBanner=true');

    expect(screen.queryByText(/You are viewing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/other suggested dashboards/)).not.toBeInTheDocument();
    expect(screen.queryByText(/create one from scratch/)).not.toBeInTheDocument();
  });
});
