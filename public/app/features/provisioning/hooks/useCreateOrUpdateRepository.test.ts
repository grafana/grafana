import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { setupProvisioningMswServer } from '../mocks/server';

import { useCreateOrUpdateRepository } from './useCreateOrUpdateRepository';

setupProvisioningMswServer();

const baseSpec: RepositorySpec = {
  type: 'github',
  title: 'repo',
  sync: { enabled: true, target: 'folder', intervalSeconds: 60 },
  workflows: [],
  github: { url: 'https://github.com/owner/repo', branch: 'main', path: '' },
};

interface CapturedBody {
  spec?: RepositorySpec;
  secure?: Record<string, { create: string }>;
}

function captureRequests() {
  const captured: { test?: CapturedBody; create?: CapturedBody; update?: CapturedBody } = {};
  server.use(
    http.post(`${BASE}/repositories/:name/test`, async ({ request }) => {
      captured.test = (await request.json()) as CapturedBody;
      return HttpResponse.json({ success: true });
    }),
    http.post(`${BASE}/repositories`, async ({ request }) => {
      const body = (await request.json()) as { spec: RepositorySpec; secure?: CapturedBody['secure'] };
      captured.create = { spec: body.spec, secure: body.secure };
      return HttpResponse.json({ metadata: { name: 'r-abc' }, spec: body.spec });
    }),
    http.put(`${BASE}/repositories/:name`, async ({ request }) => {
      const body = (await request.json()) as { spec: RepositorySpec; secure?: CapturedBody['secure'] };
      captured.update = { spec: body.spec, secure: body.secure };
      return HttpResponse.json({ metadata: { name: 'my-repo' }, spec: body.spec });
    })
  );
  return captured;
}

describe('useCreateOrUpdateRepository', () => {
  it('includes token in secure payload when provided', async () => {
    const captured = captureRequests();
    const { result } = renderHook(() => useCreateOrUpdateRepository(), { wrapper: getWrapper({}) });

    await act(async () => {
      await result.current[0](baseSpec, 'my-token');
    });

    await waitFor(() => expect(captured.create).toBeDefined());
    expect(captured.create?.secure).toEqual({ token: { create: 'my-token' } });
    expect(captured.test?.secure).toEqual({ token: { create: 'my-token' } });
  });

  it('includes signingKey in secure payload when provided', async () => {
    const captured = captureRequests();
    const { result } = renderHook(() => useCreateOrUpdateRepository(), { wrapper: getWrapper({}) });

    await act(async () => {
      await result.current[0](baseSpec, undefined, 'PGP-KEY');
    });

    await waitFor(() => expect(captured.create).toBeDefined());
    expect(captured.create?.secure).toEqual({ signingKey: { create: 'PGP-KEY' } });
  });

  it('includes both token and signingKey when both provided', async () => {
    const captured = captureRequests();
    const { result } = renderHook(() => useCreateOrUpdateRepository(), { wrapper: getWrapper({}) });

    await act(async () => {
      await result.current[0](baseSpec, 'my-token', 'PGP-KEY');
    });

    await waitFor(() => expect(captured.create).toBeDefined());
    expect(captured.create?.secure).toEqual({
      token: { create: 'my-token' },
      signingKey: { create: 'PGP-KEY' },
    });
  });

  it('omits secure when neither token nor signingKey provided', async () => {
    const captured = captureRequests();
    const { result } = renderHook(() => useCreateOrUpdateRepository(), { wrapper: getWrapper({}) });

    await act(async () => {
      await result.current[0](baseSpec);
    });

    await waitFor(() => expect(captured.create).toBeDefined());
    expect(captured.create?.secure).toBeUndefined();
  });

  it('treats empty strings as absent', async () => {
    const captured = captureRequests();
    const { result } = renderHook(() => useCreateOrUpdateRepository(), { wrapper: getWrapper({}) });

    await act(async () => {
      await result.current[0](baseSpec, '', '');
    });

    await waitFor(() => expect(captured.create).toBeDefined());
    expect(captured.create?.secure).toBeUndefined();
  });

  it('updates existing repository with secure payload', async () => {
    const captured = captureRequests();
    const { result } = renderHook(() => useCreateOrUpdateRepository('my-repo'), { wrapper: getWrapper({}) });

    await act(async () => {
      await result.current[0](baseSpec, 'my-token', 'PGP-KEY');
    });

    await waitFor(() => expect(captured.update).toBeDefined());
    expect(captured.update?.secure).toEqual({
      token: { create: 'my-token' },
      signingKey: { create: 'PGP-KEY' },
    });
  });
});
