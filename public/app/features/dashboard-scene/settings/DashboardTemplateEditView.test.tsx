import { render, screen } from 'test/test-utils';

import { SceneTimeRange } from '@grafana/scenes';
import { type DashboardMeta } from 'app/types/dashboard';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardTemplateEditView } from './DashboardTemplateEditView';
import { getDashboardTemplateSettingsTab } from './enterprise-components/DashboardTemplateSettingsTab';

jest.mock('./enterprise-components/DashboardTemplateSettingsTab', () => ({
  getDashboardTemplateSettingsTab: jest.fn(),
}));

const mockGetSettingsTab = jest.mocked(getDashboardTemplateSettingsTab);

async function buildTestScene(metaOverrides: Partial<DashboardMeta> = {}) {
  const settings = new DashboardTemplateEditView({});
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: 'Hello template',
    uid: 'dash-1',
    meta: {
      canEdit: true,
      canSave: true,
      isDashboardTemplate: true,
      dashboardTemplateUid: 'tmpl-1',
      ...metaOverrides,
    },
    editview: settings,
  });

  activateFullSceneTree(dashboard);
  await new Promise((r) => setTimeout(r, 1));
  dashboard.onEnterEditMode();
  settings.activate();

  return { dashboard, settings };
}

describe('DashboardTemplateEditView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettingsTab.mockReturnValue(undefined);
  });

  it('returns "template" from getUrlKey()', async () => {
    const { settings } = await buildTestScene();
    expect(settings.getUrlKey()).toBe('template');
  });

  it('returns the parent dashboard from getDashboard()', async () => {
    const { dashboard, settings } = await buildTestScene();
    expect(settings.getDashboard()).toBe(dashboard);
  });

  it('renders the "metadata unavailable" alert when dashboardTemplateUid is missing', async () => {
    const { settings } = await buildTestScene({ dashboardTemplateUid: undefined });
    render(<settings.Component model={settings} />);

    expect(await screen.findByText('Template metadata unavailable')).toBeInTheDocument();
  });

  it('renders the enterprise-required alert when no settings form is registered', async () => {
    mockGetSettingsTab.mockReturnValue(undefined);
    const { settings } = await buildTestScene();
    render(<settings.Component model={settings} />);

    expect(await screen.findByText('Available in Grafana Enterprise')).toBeInTheDocument();
  });

  it('renders the registered settings form with the dashboardTemplateUid passed through', async () => {
    const StubForm = jest.fn(({ dashboardTemplateUid }: { dashboardTemplateUid: string }) => (
      <div data-testid="settings-form">uid:{dashboardTemplateUid}</div>
    ));
    mockGetSettingsTab.mockReturnValue(StubForm);

    const { settings } = await buildTestScene();
    render(<settings.Component model={settings} />);

    expect(await screen.findByTestId('settings-form')).toHaveTextContent('uid:tmpl-1');
  });
});
