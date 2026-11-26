import { isStartFromAvailable } from '@grafana/assistant';
import { DASHBOARD_SCHEMA_VERSION } from 'app/features/dashboard/state/DashboardMigrator';
import { CustomDashboardTemplateInteractions } from 'app/features/dashboard-scene/analytics/dashboard-templates/main';
import { isPendingChangesEnabled } from 'app/features/dashboard-scene/lifecycle/pendingChangesFlag';
import { loadLibraryDashboard } from 'app/features/dashboard-scene/pages/templateDashboardLoader';
import { getDashboardTemplateExtension } from 'app/features/dashboard-scene/settings/enterprise-components/DashboardTemplateExtension';
import { type DashboardDTO } from 'app/types/dashboard';

import { getTemplateStartFrom } from './templateStartFrom';

jest.mock('app/features/dashboard-scene/lifecycle/pendingChangesFlag', () => ({
  isPendingChangesEnabled: jest.fn(),
}));
jest.mock('app/features/dashboard-scene/pages/templateDashboardLoader', () => ({
  loadLibraryDashboard: jest.fn(),
}));
jest.mock('app/features/dashboard-scene/settings/enterprise-components/DashboardTemplateExtension', () => ({
  getDashboardTemplateExtension: jest.fn(),
}));
jest.mock('app/features/dashboard-scene/analytics/dashboard-templates/main', () => ({
  CustomDashboardTemplateInteractions: { loaded: jest.fn() },
}));

const templateUrl =
  '/dashboard/template?datasource=testdata&title=RED+metrics&pluginId=grafana-testdata-datasource&gnetId=1' +
  '&sourceEntryPoint=empty_dashboard_prompt&libraryItemId=1&creationOrigin=dashboard_library_template_dashboard' +
  '&contentKind=template_dashboard&assistantSource=assistant_button';

/** A Grafana template as the template page loads it: a v1 dashboard with a row, on the current schema. */
const template: DashboardDTO = {
  dashboard: {
    title: 'RED metrics',
    uid: '',
    version: 0,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    panels: [
      { id: 1, type: 'stat', title: 'Requests', gridPos: { x: 0, y: 0, w: 12, h: 4 }, targets: [] },
      { id: 2, type: 'row', title: 'Latency', collapsed: false, gridPos: { x: 0, y: 4, w: 24, h: 1 }, panels: [] },
      { id: 3, type: 'timeseries', title: 'p99', gridPos: { x: 0, y: 5, w: 24, h: 8 }, targets: [] },
    ],
  },
  meta: { isNew: true, canSave: true, canEdit: true },
};

describe('getTemplateStartFrom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isPendingChangesEnabled).mockReturnValue(true);
    jest.mocked(isStartFromAvailable).mockReturnValue(true);
    jest.mocked(loadLibraryDashboard).mockResolvedValue(template);
  });

  it('gives the template page’s dashboard as a v2 spec, rows kept, with the page’s attribution', async () => {
    const startFrom = await getTemplateStartFrom(templateUrl);

    expect(loadLibraryDashboard).toHaveBeenCalledWith(new URLSearchParams(templateUrl.split('?')[1]));
    expect(startFrom?.spec.title).toBe('RED metrics');
    expect(Object.keys(startFrom?.spec.elements ?? {})).toHaveLength(2);
    expect(startFrom?.spec.layout).toMatchObject({
      kind: 'RowsLayout',
      spec: { rows: [{ spec: { hideHeader: true } }, { spec: { title: 'Latency' } }] },
    });
    expect(startFrom?.query).toEqual({
      sourceEntryPoint: 'empty_dashboard_prompt',
      libraryItemId: '1',
      creationOrigin: 'dashboard_library_template_dashboard',
      assistantSource: 'assistant_button',
    });
  });

  it('gives nothing for a template on an older schema, which only its page migrates', async () => {
    jest
      .mocked(loadLibraryDashboard)
      .mockResolvedValue({ ...template, dashboard: { ...template.dashboard, schemaVersion: 36 } });

    await expect(getTemplateStartFrom(templateUrl)).resolves.toBeUndefined();
  });

  it('gives a custom template as it is stored, reporting it loaded as its page does', async () => {
    const spec = { title: 'Ours', elements: {}, layout: { kind: 'GridLayout', spec: { items: [] } } };
    const loadTemplate = jest.fn().mockResolvedValue({ spec: { dashboard: spec } });
    jest.mocked(getDashboardTemplateExtension).mockReturnValue({ loadTemplate } as never);

    const startFrom = await getTemplateStartFrom('/dashboard/template?dashboardTemplateUid=tpl-1');

    expect(loadTemplate).toHaveBeenCalledWith('tpl-1');
    expect(startFrom).toEqual({ spec, query: {} });
    expect(CustomDashboardTemplateInteractions.loaded).toHaveBeenCalledWith({ templateUid: 'tpl-1', mode: 'use' });
    expect(loadLibraryDashboard).not.toHaveBeenCalled();
  });

  it('gives nothing without dashboards as artifacts', async () => {
    jest.mocked(isPendingChangesEnabled).mockReturnValue(false);

    await expect(getTemplateStartFrom(templateUrl)).resolves.toBeUndefined();
    expect(loadLibraryDashboard).not.toHaveBeenCalled();
  });

  it('gives nothing to an Assistant that cannot start from it', async () => {
    jest.mocked(isStartFromAvailable).mockReturnValue(false);

    await expect(getTemplateStartFrom(templateUrl)).resolves.toBeUndefined();
    expect(loadLibraryDashboard).not.toHaveBeenCalled();
  });

  it('gives nothing when the template does not load, so its page opens instead', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(loadLibraryDashboard).mockRejectedValue(new Error('grafana.com unavailable'));

    await expect(getTemplateStartFrom(templateUrl)).resolves.toBeUndefined();
  });
});
