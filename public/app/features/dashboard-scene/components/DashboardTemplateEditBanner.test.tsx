import { act, render, screen } from 'test/test-utils';

import { SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../scene/DashboardScene';
import { GeneralSettingsEditView } from '../settings/GeneralSettingsEditView';
import { getDashboardTemplateExtension } from '../settings/enterprise-components/DashboardTemplateExtension';

import { DashboardTemplateEditBanner } from './DashboardTemplateEditBanner';

jest.mock('../settings/enterprise-components/DashboardTemplateExtension', () => ({
  getDashboardTemplateExtension: jest.fn(),
}));

const mockGetExtension = jest.mocked(getDashboardTemplateExtension);

const TEMPLATE_ROUTE = '/dashboard/template';

function buildDashboard(
  opts: {
    isDashboardTemplate?: boolean;
    dashboardTemplateUid?: string;
    editview?: GeneralSettingsEditView;
    title?: string;
  } = {}
) {
  const { isDashboardTemplate, dashboardTemplateUid, editview, title } = {
    isDashboardTemplate: true,
    dashboardTemplateUid: 'tmpl-1' as string | undefined,
    title: 'Fallback Title',
    ...opts,
  };

  return new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title,
    uid: 'dash-1',
    meta: {
      canEdit: true,
      canSave: true,
      isDashboardTemplate,
      dashboardTemplateUid,
    },
    editview,
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

describe('DashboardTemplateEditBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadTemplate('Loaded Template Name');
    setTestFlags({ 'grafana.customDashboardTemplates': true });
  });

  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('renders on the template route when the dashboard is a template with a template uid', async () => {
    const dashboard = buildDashboard({});
    render(<DashboardTemplateEditBanner dashboard={dashboard} />, {
      historyOptions: { initialEntries: [TEMPLATE_ROUTE] },
    });

    expect(await screen.findByText(/You are editing Loaded Template Name/)).toBeInTheDocument();
  });

  it('falls back to the dashboard title when loadTemplate resolves without a title', async () => {
    mockLoadTemplate(undefined);
    const dashboard = buildDashboard({ title: 'My fallback' });
    render(<DashboardTemplateEditBanner dashboard={dashboard} />, {
      historyOptions: { initialEntries: [TEMPLATE_ROUTE] },
    });

    expect(await screen.findByText(/You are editing My fallback/)).toBeInTheDocument();
  });

  it('does not render when the route is not the template route', () => {
    const dashboard = buildDashboard({});
    render(<DashboardTemplateEditBanner dashboard={dashboard} />, {
      historyOptions: { initialEntries: ['/dashboard/other'] },
    });

    expect(screen.queryByText(/You are editing/)).not.toBeInTheDocument();
  });

  it('does not render when isDashboardTemplate is false', () => {
    const dashboard = buildDashboard({ isDashboardTemplate: false });
    render(<DashboardTemplateEditBanner dashboard={dashboard} />, {
      historyOptions: { initialEntries: [TEMPLATE_ROUTE] },
    });

    expect(screen.queryByText(/You are editing/)).not.toBeInTheDocument();
  });

  it('does not render when dashboardTemplateUid is missing', () => {
    const dashboard = buildDashboard({ dashboardTemplateUid: undefined });
    render(<DashboardTemplateEditBanner dashboard={dashboard} />, {
      historyOptions: { initialEntries: [TEMPLATE_ROUTE] },
    });

    expect(screen.queryByText(/You are editing/)).not.toBeInTheDocument();
  });

  it('does not render when editview is set (settings tab active)', () => {
    const dashboard = buildDashboard({ editview: new GeneralSettingsEditView({}) });
    render(<DashboardTemplateEditBanner dashboard={dashboard} />, {
      historyOptions: { initialEntries: [TEMPLATE_ROUTE] },
    });

    expect(screen.queryByText(/You are editing/)).not.toBeInTheDocument();
  });

  it('hides the banner after the dismiss button is clicked', async () => {
    const dashboard = buildDashboard({});
    const { user } = render(<DashboardTemplateEditBanner dashboard={dashboard} />, {
      historyOptions: { initialEntries: [TEMPLATE_ROUTE] },
    });

    await screen.findByText(/You are editing Loaded Template Name/);
    await user.click(screen.getByRole('button', { name: /Close alert/i }));

    expect(screen.queryByText(/You are editing/)).not.toBeInTheDocument();
  });
});
