import yaml from 'js-yaml';

import { type DashboardScene } from '../scene/DashboardScene';

import { applyJsonToDashboard, getDashboardDiffTexts, getDashboardResourceText } from './codePaneUtils';

jest.mock('../serialization/transformSceneToSaveModelSchemaV2', () => ({
  transformSceneToSaveModelSchemaV2: jest.fn(() => ({ title: 'Test dashboard' })),
}));

const mockEnsureV2Response = jest.fn();
jest.mock('../../dashboard/api/ResponseTransformers', () => ({
  ensureV2Response: (dto: unknown) => mockEnsureV2Response(dto),
}));

jest.mock('../../dashboard/api/utils', () => ({
  isDashboardV2Spec: (obj: unknown) => typeof obj === 'object' && obj !== null && 'elements' in obj,
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

describe('getDashboardDiffTexts', () => {
  const v2Initial = { elements: {}, title: 'Original title' };

  function buildDiffDashboard(initialSaveModel: unknown, uid = 'abc-123'): DashboardScene {
    return {
      state: { uid, meta: {} },
      getInitialSaveModel: () => initialSaveModel,
    } as unknown as DashboardScene;
  }

  function currentText(spec: object) {
    return JSON.stringify({
      apiVersion: 'dashboard.grafana.app/v2',
      kind: 'Dashboard',
      metadata: { name: 'abc-123' },
      spec,
    });
  }

  beforeEach(() => {
    mockEnsureV2Response.mockReset();
  });

  it('returns original and current resource texts for a v2 initial save model', () => {
    const result = getDashboardDiffTexts(
      buildDiffDashboard(v2Initial),
      currentText({ elements: {}, title: 'Changed title' })
    );

    expect(result).not.toBeNull();
    const original = JSON.parse(result!.original);
    const current = JSON.parse(result!.current);
    expect(original.apiVersion).toBe('dashboard.grafana.app/v2');
    expect(original.metadata.name).toBe('abc-123');
    expect(original.spec.title).toBe('Original title');
    expect(current.spec.title).toBe('Changed title');
    expect(result!.migratedFromV1).toBe(false);
    expect(mockEnsureV2Response).not.toHaveBeenCalled();
  });

  it('produces identical texts when only key order and null values differ', () => {
    const unorderedWithNulls = JSON.stringify({
      spec: { title: 'Original title', elements: {}, description: null },
      kind: 'Dashboard',
      metadata: { name: 'abc-123' },
      apiVersion: 'dashboard.grafana.app/v2',
    });

    const result = getDashboardDiffTexts(buildDiffDashboard(v2Initial), unorderedWithNulls);

    expect(result!.original).toBe(result!.current);
  });

  it('returns null when the editor content is not valid JSON', () => {
    expect(getDashboardDiffTexts(buildDiffDashboard(v2Initial), 'not json {')).toBeNull();
  });

  it('returns null when there is no initial save model', () => {
    expect(getDashboardDiffTexts(buildDiffDashboard(undefined), currentText({}))).toBeNull();
  });

  it('converts a v1 initial save model before diffing', () => {
    mockEnsureV2Response.mockReturnValue({ spec: { elements: {}, title: 'Converted title' } });
    const v1Initial = { schemaVersion: 41, title: 'V1 dashboard' };

    const result = getDashboardDiffTexts(buildDiffDashboard(v1Initial), currentText({ elements: {} }));

    expect(mockEnsureV2Response).toHaveBeenCalledWith(
      expect.objectContaining({ dashboard: expect.objectContaining(v1Initial) })
    );
    expect(JSON.parse(result!.original).spec.title).toBe('Converted title');
    expect(result!.migratedFromV1).toBe(true);
  });

  it('returns null when the v1 conversion fails', () => {
    mockEnsureV2Response.mockImplementation(() => {
      throw new Error('conversion failed');
    });

    expect(getDashboardDiffTexts(buildDiffDashboard({ schemaVersion: 41 }), currentText({}))).toBeNull();
  });

  it('emits YAML for both sides when format is "yaml"', () => {
    const result = getDashboardDiffTexts(
      buildDiffDashboard(v2Initial),
      currentText({ elements: {}, title: 'Changed title' }),
      'yaml'
    );

    expect(result!.original).toMatch(/^apiVersion: dashboard\.grafana\.app\/v2$/m);
    const current = yaml.load(result!.current) as { spec: { title: string } };
    expect(current.spec.title).toBe('Changed title');
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
