import yaml from 'js-yaml';

import { type DashboardScene } from '../scene/DashboardScene';

import { getDashboardJsonText, getDashboardResourceText } from './codePaneUtils';

jest.mock('../serialization/transformSceneToSaveModelSchemaV2', () => ({
  transformSceneToSaveModelSchemaV2: jest.fn(() => ({ title: 'Test dashboard' })),
}));

jest.mock('../../dashboard/api/v2', () => ({
  getK8sV2DashboardApiConfig: () => ({
    group: 'dashboard.grafana.app',
    version: 'v2',
    resource: 'dashboards',
  }),
}));

function buildDashboard(uid?: string): DashboardScene {
  return { state: { uid } } as unknown as DashboardScene;
}

describe('getDashboardResourceText', () => {
  it('returns valid JSON by default with apiVersion, kind, metadata.name and spec', () => {
    const text = getDashboardResourceText(buildDashboard('abc-123'));
    const parsed = JSON.parse(text);

    expect(parsed).toEqual({
      apiVersion: 'dashboard.grafana.app/v2',
      kind: 'Dashboard',
      metadata: { name: 'abc-123' },
      spec: { title: 'Test dashboard' },
    });
  });

  it('uses a placeholder name when the dashboard has no uid yet', () => {
    const text = getDashboardResourceText(buildDashboard(undefined));
    const parsed = JSON.parse(text);

    expect(parsed.metadata.name).toBe('<dashboard-uid>');
  });

  it('wraps the same spec returned by getDashboardJsonText', () => {
    const dashboard = buildDashboard('abc-123');
    const bareSpec = JSON.parse(getDashboardJsonText(dashboard));
    const wrapped = JSON.parse(getDashboardResourceText(dashboard));

    expect(wrapped.spec).toEqual(bareSpec);
  });

  it('emits YAML with the same envelope when format is "yaml"', () => {
    const text = getDashboardResourceText(buildDashboard('abc-123'), 'yaml');
    const parsed = yaml.load(text);

    expect(parsed).toEqual({
      apiVersion: 'dashboard.grafana.app/v2',
      kind: 'Dashboard',
      metadata: { name: 'abc-123' },
      spec: { title: 'Test dashboard' },
    });
    expect(text).toMatch(/^apiVersion: dashboard\.grafana\.app\/v2$/m);
  });
});
