import { render, screen } from 'test/test-utils';

import { SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { GeneralSettingsEditView } from '../settings/GeneralSettingsEditView';
import { getDashboardTemplateExtension } from '../settings/enterprise-components/DashboardTemplateExtension';

import { DashboardTemplateUseBanner } from './DashboardTemplateUseBanner';

jest.mock('../settings/enterprise-components/DashboardTemplateExtension', () => ({
  getDashboardTemplateExtension: jest.fn(),
}));

const mockGetExtension = jest.mocked(getDashboardTemplateExtension);

const TEMPLATE_ROUTE = '/dashboard/template';
const USE_BANNER_URL = `${TEMPLATE_ROUTE}?useTemplateBanner=true&dashboardTemplateUid=tmpl-1`;

function buildDashboard(overrides: { editview?: GeneralSettingsEditView; title?: string } = {}) {
  return new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: overrides.title ?? 'Fallback Title',
    uid: 'dash-1',
    meta: { canEdit: true, canSave: true },
    editview: overrides.editview,
  });
}

function mockLoadTemplate(title: string | undefined) {
  mockGetExtension.mockReturnValue({
    loadTemplate: jest.fn().mockResolvedValue({
      kind: 'DashboardTemplate',
      apiVersion: 'v1alpha1',
      metadata: { name: 'tmpl-1' },
      spec: { title, description: '', tags: [], dashboardVersion: '1', dashboard: {} },
    }),
    listHistory: jest
      .fn()
      .mockResolvedValue({ kind: '', apiVersion: '', metadata: { resourceVersion: '0' }, items: [] }),
    restore: jest.fn().mockResolvedValue(false),
  });
}

describe('DashboardTemplateUseBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadTemplate('Loaded Template Name');
  });

  it('renders on the template route when useTemplateBanner=true and dashboardTemplateUid is set', async () => {
    render(<DashboardTemplateUseBanner dashboard={buildDashboard()} />, {
      historyOptions: { initialEntries: [USE_BANNER_URL] },
    });

    expect(await screen.findByText(/Loaded Template Name template in a new dashboard/)).toBeInTheDocument();
  });

  it('falls back to the dashboard title when loadTemplate resolves without a title', async () => {
    mockLoadTemplate(undefined);
    render(<DashboardTemplateUseBanner dashboard={buildDashboard({ title: 'My fallback' })} />, {
      historyOptions: { initialEntries: [USE_BANNER_URL] },
    });

    expect(await screen.findByText(/My fallback template in a new dashboard/)).toBeInTheDocument();
  });

  it('does not render when useTemplateBanner is missing from the URL', () => {
    render(<DashboardTemplateUseBanner dashboard={buildDashboard()} />, {
      historyOptions: { initialEntries: [`${TEMPLATE_ROUTE}?dashboardTemplateUid=tmpl-1`] },
    });

    expect(screen.queryByText(/template in a new dashboard/)).not.toBeInTheDocument();
  });

  it('does not render when the route is not the template route', () => {
    render(<DashboardTemplateUseBanner dashboard={buildDashboard()} />, {
      historyOptions: { initialEntries: ['/dashboard/other?useTemplateBanner=true&dashboardTemplateUid=tmpl-1'] },
    });

    expect(screen.queryByText(/template in a new dashboard/)).not.toBeInTheDocument();
  });

  it('does not render when editview is set (settings tab active)', () => {
    render(<DashboardTemplateUseBanner dashboard={buildDashboard({ editview: new GeneralSettingsEditView({}) })} />, {
      historyOptions: { initialEntries: [USE_BANNER_URL] },
    });

    expect(screen.queryByText(/template in a new dashboard/)).not.toBeInTheDocument();
  });

  it('hides the banner when dismissed', async () => {
    const { user } = render(<DashboardTemplateUseBanner dashboard={buildDashboard()} />, {
      historyOptions: { initialEntries: [USE_BANNER_URL] },
    });

    await screen.findByText(/Loaded Template Name template in a new dashboard/);
    await user.click(screen.getByRole('button', { name: /Close alert/i }));

    expect(screen.queryByText(/template in a new dashboard/)).not.toBeInTheDocument();
  });
});
