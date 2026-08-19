import yaml from 'js-yaml';

import { type DashboardScene } from '../scene/DashboardScene';

import { applyJsonToDashboard, getDashboardResourceText } from './codePaneUtils';

jest.mock('../serialization/transformSceneToSaveModelSchemaV2', () => ({
  transformSceneToSaveModelSchemaV2: jest.fn(() => ({ title: 'Test dashboard' })),
}));

jest.mock('../serialization/transformSaveModelSchemaV2ToScene', () => ({
  transformSaveModelSchemaV2ToScene: jest.fn(() => ({ state: {} })),
}));

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneUtils: { ...actual.sceneUtils, cloneSceneObjectState: (state: unknown) => state },
  };
});

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

function buildApplyDashboard(uid?: string): DashboardScene {
  return {
    state: { uid, key: 'key-1', isEditing: true, meta: {} },
    serializer: { metadata: {} },
    onEnterEditMode: jest.fn(),
    setState: jest.fn(),
    publishEvent: jest.fn(),
  } as unknown as DashboardScene;
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

describe('applyJsonToDashboard', () => {
  it('rejects an unexpected kind', () => {
    const result = applyJsonToDashboard(buildApplyDashboard('abc-123'), JSON.stringify({ kind: 'Folder', spec: {} }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid kind');
  });

  it('rejects an unexpected apiVersion', () => {
    const result = applyJsonToDashboard(
      buildApplyDashboard('abc-123'),
      JSON.stringify({ apiVersion: 'dashboard.grafana.app/v1', spec: {} })
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid apiVersion');
  });

  it('rejects changing the identifier', () => {
    const result = applyJsonToDashboard(
      buildApplyDashboard('abc-123'),
      JSON.stringify({ metadata: { name: 'different' }, spec: {} })
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('identifier');
  });

  it('rejects editing metadata beyond the name', () => {
    const result = applyJsonToDashboard(
      buildApplyDashboard('abc-123'),
      JSON.stringify({ metadata: { name: 'abc-123', labels: { a: 'b' } }, spec: {} })
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('metadata');
  });

  it('rejects a single unsupported metadata field even when name is absent', () => {
    const result = applyJsonToDashboard(
      buildApplyDashboard('abc-123'),
      JSON.stringify({ metadata: { labels: { a: 'b' } }, spec: {} })
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('metadata');
  });

  it('applies the resource text generated for a saved dashboard', () => {
    const text = getDashboardResourceText(buildDashboard('abc-123'));
    const result = applyJsonToDashboard(buildApplyDashboard('abc-123'), text);
    expect(result.success).toBe(true);
  });

  // Regression: the pane emits a placeholder metadata.name for a dashboard with no uid yet;
  // applying that unchanged JSON must not be rejected as an identifier change.
  it('applies the placeholder resource text for an unsaved dashboard', () => {
    const text = getDashboardResourceText(buildDashboard(undefined));
    const result = applyJsonToDashboard(buildApplyDashboard(undefined), text);
    expect(result.success).toBe(true);
  });
});
