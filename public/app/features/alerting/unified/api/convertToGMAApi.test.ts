import { HttpResponse, http } from 'msw';
import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setupMswServer } from '../mockApi';

import { convertToGMAApi } from './convertToGMAApi';

const server = setupMswServer();
const CONVERT_URL = '/api/convert/api/v1/alerts';
const SAMPLE_YAML = ['route:', '  receiver: default', 'receivers:', '  - name: default', ''].join('\n');
// Genuinely invalid per js-yaml: bad indentation of a mapping entry.
const INVALID_YAML = ['route:', '  receiver: default', 'foo: bar: baz', ''].join('\n');

const wrapper = getWrapper({ renderWithRouter: true });

function yamlFile(content = SAMPLE_YAML, name = 'am.yaml') {
  return new File([content], name, { type: 'application/yaml' });
}

function countRequests() {
  let count = 0;
  server.use(
    http.post(CONVERT_URL, () => {
      count += 1;
      return HttpResponse.json({ status: 'success' });
    })
  );
  return () => count;
}

describe('validateAlertmanagerConfigImport', () => {
  it('resolves the config and returns a successful response', async () => {
    server.use(http.post(CONVERT_URL, () => HttpResponse.json({ status: 'success' })));
    // Built once, outside the render callback: `File`'s `lastModified` defaults to `Date.now()`
    // when omitted, so constructing a fresh File on every render would churn the signature-based
    // cache key each render and the query would never settle on one key long enough to resolve.
    const args = { source: 'yaml' as const, yamlFile: yamlFile(), configIdentifier: 'prod' };

    const { result } = renderHook(() => convertToGMAApi.useValidateAlertmanagerConfigImportQuery(args), { wrapper });

    await waitFor(() => expect(result.current.currentData?.status).toBe('success'), { timeout: 5000 });
  });

  it('sends the dry-run and force-replace headers', async () => {
    const headers: Headers[] = [];
    server.use(
      http.post(CONVERT_URL, ({ request }) => {
        headers.push(request.headers);
        return HttpResponse.json({ status: 'success' });
      })
    );
    const args = { source: 'yaml' as const, yamlFile: yamlFile(), configIdentifier: 'prod' };

    const { result } = renderHook(() => convertToGMAApi.useValidateAlertmanagerConfigImportQuery(args), { wrapper });

    await waitFor(() => expect(result.current.currentData).toBeDefined());
    expect(headers).toHaveLength(1);
    expect(headers[0].get('X-Grafana-Alerting-Dry-Run')).toBe('true');
    expect(headers[0].get('X-Grafana-Alerting-Config-Force-Replace')).toBe('true');
    expect(headers[0].get('X-Grafana-Alerting-Config-Identifier')).toBe('prod');
  });

  it('rejects invalid YAML locally without ever calling the backend', async () => {
    const getRequestCount = countRequests();
    const args = { source: 'yaml' as const, yamlFile: yamlFile(INVALID_YAML, 'broken.yaml'), configIdentifier: 'prod' };

    const { result } = renderHook(() => convertToGMAApi.useValidateAlertmanagerConfigImportQuery(args), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.error).toMatchObject({ message: expect.stringMatching(/syntax error/i) });
    expect(getRequestCount()).toBe(0);
  });

  it('keeps two different signatures in independent cache entries', async () => {
    server.use(
      http.post(CONVERT_URL, async ({ request }) => {
        const body = await request.clone().json();
        // Echo the config content back so each response is distinguishable by its own request.
        return HttpResponse.json({ status: 'success', error: body.alertmanager_config });
      })
    );

    const argsA = { source: 'yaml' as const, yamlFile: yamlFile(SAMPLE_YAML, 'a.yaml'), configIdentifier: 'prod' };
    const argsB = {
      source: 'yaml' as const,
      yamlFile: yamlFile(INVALID_YAML.replace('foo: bar: baz', 'foo: baz'), 'b.yaml'),
      configIdentifier: 'prod',
    };

    const { result: resultA } = renderHook(() => convertToGMAApi.useValidateAlertmanagerConfigImportQuery(argsA), {
      wrapper,
    });
    const { result: resultB } = renderHook(() => convertToGMAApi.useValidateAlertmanagerConfigImportQuery(argsB), {
      wrapper,
    });

    await waitFor(() => expect(resultA.current.currentData).toBeDefined());
    await waitFor(() => expect(resultB.current.currentData).toBeDefined());
    expect(resultA.current.currentData).not.toEqual(resultB.current.currentData);
  });

  // Regression target: revisiting an already-validated signature must not re-hit the backend.
  it('serves a cache hit for an unchanged signature instead of refetching', async () => {
    const getRequestCount = countRequests();
    const args = { source: 'yaml' as const, yamlFile: yamlFile(), configIdentifier: 'prod' };

    const { result, rerender } = renderHook(
      (queryArgs) => convertToGMAApi.useValidateAlertmanagerConfigImportQuery(queryArgs),
      { wrapper, initialProps: args }
    );

    await waitFor(() => expect(result.current.currentData).toBeDefined());
    expect(getRequestCount()).toBe(1);

    // Same File instance, same identifier — an unrelated re-render with unchanged args.
    rerender(args);

    expect(result.current.currentData).toBeDefined();
    expect(getRequestCount()).toBe(1);
  });
});
