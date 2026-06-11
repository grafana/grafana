import yaml from 'js-yaml';

import { type DashboardScene } from '../scene/DashboardScene';

import { buildSharingExport, formatForEditor, getSharingExportText } from './codePaneUtils';

const mockMakeExportableV2 = jest.fn();

jest.mock('../scene/export/exporters', () => ({
  ...jest.requireActual('../scene/export/exporters'),
  makeExportableV2: (...args: unknown[]) => mockMakeExportableV2(...args),
}));

jest.mock('../../dashboard/api/v2', () => ({
  getK8sV2DashboardApiConfig: () => ({ version: 'v2' }),
}));

const makeExportableV2Mock = mockMakeExportableV2;

function createDashboard(): DashboardScene {
  return {
    state: { uid: 'abc-123' },
    serializer: {
      metadata: {
        name: 'abc-123',
        resourceVersion: '42',
        creationTimestamp: '2024-01-01T00:00:00Z',
        uid: 'should-be-stripped',
        labels: { 'grafana.app/internal': 'x', team: 'frontend' },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('formatForEditor', () => {
  const jsonText = JSON.stringify({ title: 'My dashboard', tags: ['a', 'b'] }, null, 2);

  it('returns the JSON text unchanged for the json format', () => {
    expect(formatForEditor(jsonText, 'json')).toBe(jsonText);
  });

  it('converts the JSON text to YAML for the yaml format', () => {
    const result = formatForEditor(jsonText, 'yaml');
    expect(result).toBe(yaml.dump({ title: 'My dashboard', tags: ['a', 'b'] }));
    expect(result).toContain('title: My dashboard');
  });
});

describe('buildSharingExport', () => {
  it('wraps the exported spec in the sharing envelope and strips internal metadata', async () => {
    const exportedSpec = { title: 'My dashboard', exported: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    makeExportableV2Mock.mockResolvedValue(exportedSpec as any);

    const jsonText = JSON.stringify({ title: 'My dashboard' });
    const envelope = await buildSharingExport(createDashboard(), jsonText);

    expect(envelope.spec).toEqual(exportedSpec);
    expect(makeExportableV2Mock).toHaveBeenCalledWith({ title: 'My dashboard' }, true);
    expect(envelope.apiVersion).toBe('v2');
    expect(envelope.kind).toBe('Dashboard');

    // External-sharing metadata stripping removes uid and grafana.app/* labels.
    expect(envelope.metadata).not.toHaveProperty('uid');
    expect(envelope.metadata.labels).toEqual({ team: 'frontend' });
    expect(envelope.metadata.name).toBe('abc-123');
  });
});

describe('getSharingExportText', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    makeExportableV2Mock.mockResolvedValue({ title: 'My dashboard' } as any);
  });

  it('produces pretty-printed JSON for the json format', async () => {
    const text = await getSharingExportText(createDashboard(), '{"title":"My dashboard"}', 'json');
    const parsed = JSON.parse(text);
    expect(parsed.kind).toBe('Dashboard');
    expect(text).toContain('\n  '); // pretty-printed with indentation
  });

  it('produces YAML for the yaml format', async () => {
    const text = await getSharingExportText(createDashboard(), '{"title":"My dashboard"}', 'yaml');
    expect(text).toContain('kind: Dashboard');
    expect(text).toContain('apiVersion: v2');
  });
});
