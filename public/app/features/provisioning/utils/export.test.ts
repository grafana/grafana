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

  it('exports a repository as a manifest and strips status + annotations', async () => {
    const repository: Repository = {
      apiVersion: 'provisioning.grafana.app/v0alpha1',
      kind: 'Repository',
      metadata: {
        name: 'my-repo',
        namespace: 'default',
        annotations: { [AnnoKeyManagerKind]: ManagerKind.Terraform },
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
    expect(JSON.stringify(manifest)).not.toContain('enc-token-ref');
  });

  it('omits the connection-minted token so a connection-backed repository stays applyable', async () => {
    const repository: Repository = {
      metadata: { name: 'conn-repo' },
      spec: {
        title: 'Connection Repo',
        type: 'github',
        sync: { target: 'folder', enabled: false },
        workflows: ['write'],
        connection: { name: 'my-github-app' },
      },
      secure: {
        token: { name: 'enc-minted-token-ref' },
        webhookSecret: { name: 'enc-webhook-ref' },
      },
    };

    exportResourceAsJson(repository, 'Repository');
    const manifest = await savedManifest();

    expect(manifest.spec?.connection).toEqual({ name: 'my-github-app' });
    expect(manifest.secure).toEqual({ webhookSecret: { create: '<replace-with-webhookSecret>' } });
  });

  it('keeps the token placeholder for a repository that authenticates with its own token', async () => {
    const repository: Repository = {
      metadata: { name: 'token-repo' },
      spec: { title: 'Token Repo', type: 'github', sync: { target: 'folder', enabled: false }, workflows: ['write'] },
      secure: { token: { name: 'enc-token-ref' } },
    };

    exportResourceAsJson(repository, 'Repository');
    const manifest = await savedManifest();

    expect(manifest.secure).toEqual({ token: { create: '<replace-with-token>' } });
  });

  it('omits the derived token from an authorized OAuth connection but keeps its client secret', async () => {
    const connection: Connection = {
      metadata: { name: 'oauth-conn' },
      spec: { title: 'OAuth Conn', type: 'githubOAuth' },
      secure: {
        // Set once the user authorizes the app; a serialized oauth2.Token, not a fillable credential.
        token: { name: 'enc-oauth-token-ref' },
        clientSecret: { name: 'enc-client-secret-ref' },
      },
    };

    exportResourceAsJson(connection, 'Connection');
    const manifest = await savedManifest();

    expect(manifest.secure).toEqual({ clientSecret: { create: '<replace-with-clientSecret>' } });
  });

  it('omits the derived token from a GitHub App connection but keeps its private key', async () => {
    const connection: Connection = {
      metadata: { name: 'app-conn' },
      spec: { title: 'App Conn', type: 'github' },
      secure: {
        // Minted as a JWT from the private key, so it cannot be supplied by hand.
        token: { name: 'enc-jwt-ref' },
        privateKey: { name: 'enc-private-key-ref' },
      },
    };

    exportResourceAsJson(connection, 'Connection');
    const manifest = await savedManifest();

    expect(manifest.secure).toEqual({ privateKey: { create: '<replace-with-privateKey>' } });
  });

  it('prefers the resource own apiVersion/kind over the fallback', async () => {
    const repository: Repository = {
      apiVersion: 'provisioning.grafana.app/v1beta1',
      kind: 'Repository',
      metadata: { name: 'r' },
      spec: { title: 'r', type: 'github', sync: { target: 'folder', enabled: false }, workflows: [] },
    };

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
