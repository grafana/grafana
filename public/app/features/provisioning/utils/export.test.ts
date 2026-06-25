import saveAs from 'file-saver';

import { type Connection, type Repository } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { exportResourceAsJson } from './export';

jest.mock('file-saver', () => jest.fn());

interface SavedManifest {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string; namespace?: string; annotations?: Record<string, string> };
  spec?: Record<string, unknown>;
  secure?: Record<string, { create: string }>;
  status?: unknown;
  __filename: string;
}

const savedManifest = async (): Promise<SavedManifest> => {
  const mockSaveAs = jest.mocked(saveAs);
  expect(mockSaveAs).toHaveBeenCalledTimes(1);
  const [blob, filename] = mockSaveAs.mock.calls[0];
  const text = await (blob as Blob).text();
  return { ...JSON.parse(text), __filename: filename };
};

describe('exportResourceAsJson', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exports a repository as a manifest and strips status + manager annotations', async () => {
    const repository: Repository = {
      apiVersion: 'provisioning.grafana.app/v0alpha1',
      kind: 'Repository',
      metadata: {
        name: 'my-repo',
        namespace: 'default',
        annotations: { [AnnoKeyManagerKind]: ManagerKind.FileProvisioning },
      },
      spec: { title: 'My Repo', type: 'github', sync: { target: 'folder', enabled: false }, workflows: [] },
      status: {
        health: { healthy: true, checked: 0 },
        sync: { state: 'success', message: [] },
        observedGeneration: 3,
        webhook: {},
      },
    };

    exportResourceAsJson(repository, 'Repository');
    const manifest = await savedManifest();

    expect(manifest.__filename).toBe('my-repo.json');
    expect(manifest.apiVersion).toBe('provisioning.grafana.app/v0alpha1');
    expect(manifest.kind).toBe('Repository');
    expect(manifest.metadata).toEqual({ name: 'my-repo', namespace: 'default' });
    expect(manifest.metadata?.annotations).toBeUndefined();
    expect(manifest.spec?.title).toBe('My Repo');
    expect(manifest.status).toBeUndefined();
  });

  it('replaces every configured secret with a create placeholder', async () => {
    const repository: Repository = {
      metadata: { name: 'secret-repo' },
      spec: { title: 'Secret Repo', type: 'github', sync: { target: 'folder', enabled: false }, workflows: [] },
      secure: {
        // Stored secrets come back as name references; they must not be exported verbatim.
        token: { name: 'enc-token-ref' },
        webhookSecret: { name: 'enc-webhook-ref' },
      },
    };

    exportResourceAsJson(repository, 'Repository');
    const manifest = await savedManifest();

    expect(manifest.secure).toEqual({
      token: { create: '<replace-with-token>' },
      webhookSecret: { create: '<replace-with-webhookSecret>' },
    });
    // The encrypted reference must never leak into the export.
    expect(JSON.stringify(manifest)).not.toContain('enc-token-ref');
  });

  it('prefers the resource own apiVersion/kind over the fallback', async () => {
    const repository: Repository = {
      apiVersion: 'provisioning.grafana.app/v1beta1',
      kind: 'Repository',
      metadata: { name: 'r' },
      spec: { title: 'r', type: 'github', sync: { target: 'folder', enabled: false }, workflows: [] },
    };

    // Pass a deliberately different fallback to prove the resource values win.
    exportResourceAsJson(repository, 'Connection');
    const manifest = await savedManifest();

    expect(manifest.apiVersion).toBe('provisioning.grafana.app/v1beta1');
    expect(manifest.kind).toBe('Repository');
  });

  it('falls back to the client API version and the given kind when the resource omits them', async () => {
    const connection: Connection = {
      metadata: { name: 'c' },
      spec: { title: 'c', type: 'github' },
    };

    exportResourceAsJson(connection, 'Connection');
    const manifest = await savedManifest();

    expect(manifest.apiVersion).toBe('provisioning.grafana.app/v0alpha1');
    expect(manifest.kind).toBe('Connection');
  });

  it('omits the secure block when the resource has no secrets', async () => {
    const connection: Connection = {
      metadata: { name: 'conn' },
      spec: { title: 'Conn', type: 'github' },
    };

    exportResourceAsJson(connection, 'Connection');
    const manifest = await savedManifest();

    expect(manifest.kind).toBe('Connection');
    expect(manifest.secure).toBeUndefined();
  });

  it('falls back to the kind for the filename when unnamed', async () => {
    exportResourceAsJson({ spec: { title: 'x', type: 'github' } } as Connection, 'Connection');
    const manifest = await savedManifest();
    expect(manifest.__filename).toBe('connection.json');
  });
});
