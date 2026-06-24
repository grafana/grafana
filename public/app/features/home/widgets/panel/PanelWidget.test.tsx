import { render, screen } from 'test/test-utils';

import { PanelWidget } from './PanelWidget';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

// A missing dashboard/panel must surface the non-destructive "unavailable" state rather than throw.
jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: async () => ({
    getDashboardDTO: async () => {
      throw new Error('not found');
    },
  }),
}));

describe('PanelWidget', () => {
  it('renders the unavailable state when the dashboard cannot be fetched', async () => {
    render(<PanelWidget dashboardUid="d1" panelId={3} />);

    expect(await screen.findByText('This panel is no longer available.')).toBeInTheDocument();
  });
});
