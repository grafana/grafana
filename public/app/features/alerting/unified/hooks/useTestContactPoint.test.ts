import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { GrafanaManagedContactPoint, GrafanaManagedReceiverConfig } from 'app/plugins/datasource/alertmanager/types';

import { TestIntegrationResponse } from '../api/testIntegrationApi';
import { setupMswServer } from '../mockApi';
import { GrafanaChannelValues } from '../types/receiver-form';
import { K8sAnnotations } from '../utils/k8s/constants';

import { useTestContactPoint } from './useTestContactPoint';

const server = setupMswServer();

interface K8sTestRequestBody {
  integrationRef?: { uid: string };
  integration?: {
    uid?: string;
    type: string;
    [key: string]: unknown;
  };
  alert: {
    labels: Record<string, string>;
    annotations: Record<string, string>;
  };
}

const wrapper = () => getWrapper({ renderWithRouter: true });

const K8S_TEST_ENDPOINT = '/apis/alertingnotifications.grafana.app/v0alpha1/namespaces/:namespace/receivers/:name/test';

const defaultK8sSuccessResponse: TestIntegrationResponse = {
  apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
  kind: 'CreateReceiverIntegrationTest',
  status: 'success',
  duration: '100ms',
};

interface K8sTestHandlerOptions {
  onRequestBody?: (body: unknown) => void;
  onRequestUrl?: (url: string) => void;
  response?: Partial<TestIntegrationResponse>;
  status?: number;
  waitFor?: Promise<void>;
  networkError?: boolean;
}

// Creates a MSW handler for the K8s receiver test endpoint.
function createK8sTestHandler(options: K8sTestHandlerOptions = {}) {
  return http.post(K8S_TEST_ENDPOINT, async ({ request }) => {
    options.onRequestUrl?.(request.url);

    if (!options.networkError) {
      const body = await request.json();
      options.onRequestBody?.(body);
    }

    if (options.waitFor) {
      await options.waitFor;
    }

    if (options.networkError) {
      return HttpResponse.error();
    }

    return HttpResponse.json({ ...defaultK8sSuccessResponse, ...options.response }, { status: options.status });
  });
}

// Mock data factories
const createChannelValues = (overrides?: Partial<GrafanaChannelValues>): GrafanaChannelValues => ({
  __id: '1',
  type: 'webhook',
  settings: { url: 'https://example.com' },
  secureFields: {},
  disableResolveMessage: false,
  ...overrides,
});

const createExistingIntegration = (
  overrides?: Partial<GrafanaManagedReceiverConfig>
): GrafanaManagedReceiverConfig => ({
  uid: 'integration-123',
  type: 'webhook',
  settings: { url: 'https://example.com' },
  secureFields: {},
  disableResolveMessage: false,
  ...overrides,
});

const createContactPoint = (overrides?: Partial<GrafanaManagedContactPoint>): GrafanaManagedContactPoint => ({
  id: 'receiver-uid-123',
  name: 'Test Receiver',
  grafana_managed_receiver_configs: [],
  metadata: {
    name: 'Test Receiver',
    namespace: 'default',
    uid: 'receiver-uid-123',
    annotations: {
      [K8sAnnotations.AccessTest]: 'true',
    },
  },
  ...overrides,
});

const defaultChannelValues = createChannelValues();

describe('useTestContactPoint', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  describe('canTest logic', () => {
    it('should return canTest=true when contactPoint is undefined (new receiver)', () => {
      const { result } = renderHook(() => useTestContactPoint({ contactPoint: undefined, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      expect(result.current.canTest).toBe(true);
    });

    it('should return canTest=true when canTest annotation is "true"', () => {
      const contactPoint = createContactPoint({
        metadata: {
          name: 'Test Receiver',
          namespace: 'default',
          uid: 'receiver-uid-123',
          annotations: { [K8sAnnotations.AccessTest]: 'true' },
        },
      });

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      expect(result.current.canTest).toBe(true);
    });

    it('should return canTest=false when canTest annotation is "false"', () => {
      const contactPoint = createContactPoint({
        metadata: {
          name: 'Test Receiver',
          namespace: 'default',
          uid: 'receiver-uid-123',
          annotations: { [K8sAnnotations.AccessTest]: 'false' },
        },
      });

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      expect(result.current.canTest).toBe(false);
    });

    it('should return canTest=false when canTest annotation is missing', () => {
      const contactPoint = createContactPoint({
        metadata: {
          name: 'Test Receiver',
          namespace: 'default',
          uid: 'receiver-uid-123',
          annotations: {},
        },
      });

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      expect(result.current.canTest).toBe(false);
    });
  });

  describe('API path selection', () => {
    const originalFeatureToggles = config.featureToggles;

    beforeEach(() => {
      server.resetHandlers();
    });

    afterEach(() => {
      config.featureToggles = originalFeatureToggles;
      server.resetHandlers();
    });

    it('should use K8s API when alertingImportAlertmanagerUI is enabled', async () => {
      // Suppress expected RTK Query async state update warnings
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        config.featureToggles = { ...originalFeatureToggles, alertingImportAlertmanagerUI: true };

        let requestUrl: string | undefined;
        server.use(createK8sTestHandler({ onRequestUrl: (url) => (requestUrl = url) }));

        const contactPoint = createContactPoint();
        const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
          wrapper: wrapper(),
        });

        const testPromise = result.current.testChannel({
          channelValues: createChannelValues(),
          existingIntegration: createExistingIntegration(),
        });

        await act(async () => {
          await testPromise;
        });

        // Wait for RTK Query state updates to complete and request to be made
        await waitFor(
          () => {
            expect(result.current.isLoading).toBe(false);
          },
          { timeout: 3000 }
        );

        expect(requestUrl).not.toBeUndefined();
        expect(requestUrl).toContain('/apis/alertingnotifications.grafana.app/');
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should use old API when alertingImportAlertmanagerUI is disabled', async () => {
      // Suppress expected RTK Query async state update warnings
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        config.featureToggles = { ...originalFeatureToggles, alertingImportAlertmanagerUI: false };

        let requestUrl: string | undefined;
        server.use(
          http.post('*/config/api/v1/receivers/test', ({ request }) => {
            requestUrl = request.url;
            return HttpResponse.json({
              notified_at: new Date().toISOString(),
              receivers: [
                {
                  name: 'Test Receiver',
                  grafana_managed_receiver_configs: [{ name: 'webhook', status: 'ok' }],
                },
              ],
            });
          })
        );

        const contactPoint = createContactPoint();
        const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
          wrapper: wrapper(),
        });

        const testPromise = result.current.testChannel({
          channelValues: createChannelValues(),
          existingIntegration: createExistingIntegration(),
        });

        await act(async () => {
          await testPromise;
        });

        await waitFor(
          () => {
            expect(result.current.isLoading).toBe(false);
          },
          { timeout: 3000 }
        );

        expect(requestUrl).not.toBeUndefined();
        expect(requestUrl).toContain('/api/alertmanager/');
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('K8s API request construction', () => {
    const originalFeatureToggles = config.featureToggles;

    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingImportAlertmanagerUI: true };
      server.resetHandlers();
    });

    afterEach(() => {
      config.featureToggles = originalFeatureToggles;
      server.resetHandlers();
    });

    it('should use test-by-reference when integration has not changed', async () => {
      let capturedBody: unknown;
      server.use(
        createK8sTestHandler({
          onRequestBody: (body) => {
            capturedBody = body;
          },
        })
      );

      const existingIntegration = createExistingIntegration();
      const channelValues = createChannelValues(); // Same as existing
      const contactPoint = createContactPoint();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({ channelValues, existingIntegration });
      });

      expect(capturedBody).not.toBeUndefined();
      expect(capturedBody).toEqual({
        integrationRef: { uid: 'integration-123' },
        alert: { labels: { alertname: 'TestAlert' }, annotations: {} },
      });
    });

    it('should use test-with-config when integration has changed (settings changed)', async () => {
      let capturedBody: unknown;
      server.use(
        createK8sTestHandler({
          onRequestBody: (body) => {
            capturedBody = body;
          },
        })
      );

      const existingIntegration = createExistingIntegration();
      const channelValues = createChannelValues({
        settings: { url: 'https://changed.com' },
      });
      const contactPoint = createContactPoint();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({ channelValues, existingIntegration });
      });

      expect(capturedBody).not.toBeUndefined();
      expect(capturedBody).toHaveProperty('integration');
      expect(capturedBody).not.toHaveProperty('integrationRef');
      const body = capturedBody as K8sTestRequestBody;
      expect(body.integration?.uid).toBe('integration-123');
      expect(body.integration?.type).toBe('webhook');
    });

    it('should use test-with-config when type has changed', async () => {
      let capturedBody: unknown;
      server.use(createK8sTestHandler({ onRequestBody: (body) => (capturedBody = body) }));

      const existingIntegration = createExistingIntegration({ type: 'webhook' });
      const channelValues = createChannelValues({ type: 'email' });
      const contactPoint = createContactPoint();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({ channelValues, existingIntegration });
      });

      expect(capturedBody).not.toBeUndefined();
      expect(capturedBody).toHaveProperty('integration');
      expect(capturedBody).not.toHaveProperty('integrationRef');
      const body = capturedBody as K8sTestRequestBody;
      expect(body.integration?.type).toBe('email');
    });

    it('should use test-with-config when disableResolveMessage has changed', async () => {
      let capturedBody: unknown;
      server.use(
        createK8sTestHandler({
          onRequestBody: (body) => {
            capturedBody = body;
          },
        })
      );

      const existingIntegration = createExistingIntegration({ disableResolveMessage: false });
      const channelValues = createChannelValues({ disableResolveMessage: true });
      const contactPoint = createContactPoint();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({ channelValues, existingIntegration });
      });

      expect(capturedBody).not.toBeUndefined();
      expect(capturedBody).toHaveProperty('integration');
      expect(capturedBody).not.toHaveProperty('integrationRef');
    });

    it('should use test-with-config when a secure field was cleared', async () => {
      let capturedBody: unknown;
      server.use(createK8sTestHandler({ onRequestBody: (body) => (capturedBody = body) }));

      const existingIntegration = createExistingIntegration({
        secureFields: { password: true },
      });
      const channelValues = createChannelValues({
        secureFields: { password: false },
      });
      const contactPoint = createContactPoint();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({ channelValues, existingIntegration });
      });

      expect(capturedBody).not.toBeUndefined();
      expect(capturedBody).toHaveProperty('integration');
      expect(capturedBody).not.toHaveProperty('integrationRef');
    });

    it('should use test-by-reference when secure field is still marked as secure', async () => {
      let capturedBody: unknown;
      server.use(
        createK8sTestHandler({
          onRequestBody: (body) => {
            capturedBody = body;
          },
        })
      );

      const existingIntegration = createExistingIntegration({
        secureFields: { password: true },
      });
      const channelValues = createChannelValues({
        secureFields: { password: true },
      });
      const contactPoint = createContactPoint();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({ channelValues, existingIntegration });
      });

      expect(capturedBody).not.toBeUndefined();
      expect(capturedBody).toEqual({
        integrationRef: { uid: 'integration-123' },
        alert: { labels: { alertname: 'TestAlert' }, annotations: {} },
      });
    });

    it('should use test-by-reference when nested settings are unchanged', async () => {
      let capturedBody: unknown;
      server.use(
        createK8sTestHandler({
          onRequestBody: (body) => {
            capturedBody = body;
          },
        })
      );

      const nestedSettings = { config: { nested: { value: 1 } } };
      const existingIntegration = createExistingIntegration({
        settings: nestedSettings,
      });
      const channelValues = createChannelValues({
        settings: nestedSettings,
      });
      const contactPoint = createContactPoint();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({ channelValues, existingIntegration });
      });

      expect(capturedBody).not.toBeUndefined();
      expect(capturedBody).toEqual({
        integrationRef: { uid: 'integration-123' },
        alert: { labels: { alertname: 'TestAlert' }, annotations: {} },
      });
    });

    it('should use test-with-config when nested settings have changed', async () => {
      let capturedBody: unknown;
      server.use(
        createK8sTestHandler({
          onRequestBody: (body) => {
            capturedBody = body;
          },
        })
      );

      const existingIntegration = createExistingIntegration({
        settings: { config: { nested: { value: 1 } } },
      });
      const channelValues = createChannelValues({
        settings: { config: { nested: { value: 2 } } },
      });
      const contactPoint = createContactPoint();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({ channelValues, existingIntegration });
      });

      expect(capturedBody).not.toBeUndefined();
      expect(capturedBody).toHaveProperty('integration');
      expect(capturedBody).not.toHaveProperty('integrationRef');
    });

    it('should use test-with-config for new integrations (no existingIntegration)', async () => {
      let capturedBody: unknown;
      server.use(
        createK8sTestHandler({
          onRequestBody: (body) => {
            capturedBody = body;
          },
        })
      );

      const channelValues = createChannelValues();
      const contactPoint = createContactPoint();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({ channelValues, existingIntegration: undefined });
      });

      expect(capturedBody).not.toBeUndefined();
      expect(capturedBody).toHaveProperty('integration');
      expect(capturedBody).not.toHaveProperty('integrationRef');
      const body = capturedBody as K8sTestRequestBody;
      expect(body.integration?.uid).toBeUndefined();
    });

    it('should use "-" placeholder for new receiver (no contactPoint.id)', async () => {
      let capturedUrl: string | undefined;
      server.use(
        createK8sTestHandler({
          onRequestUrl: (url) => {
            capturedUrl = url;
          },
        })
      );

      const contactPoint = createContactPoint({ id: '' });
      const channelValues = createChannelValues();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({ channelValues });
      });

      expect(capturedUrl).not.toBeUndefined();
      expect(capturedUrl).toContain('/receivers/-/test');
    });

    it('should include custom alert labels and annotations', async () => {
      let capturedBody: unknown;
      server.use(
        createK8sTestHandler({
          onRequestBody: (body) => {
            capturedBody = body;
          },
        })
      );

      const contactPoint = createContactPoint();
      const channelValues = createChannelValues();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        await result.current.testChannel({
          channelValues,
          alert: {
            labels: { severity: 'critical', alertname: 'CustomAlert' },
            annotations: { summary: 'Test summary' },
          },
        });
      });

      expect(capturedBody).not.toBeUndefined();
      const body = capturedBody as K8sTestRequestBody;
      expect(body.alert).toEqual({
        labels: { severity: 'critical', alertname: 'CustomAlert' },
        annotations: { summary: 'Test summary' },
      });
    });
  });

  describe('error handling', () => {
    const originalFeatureToggles = config.featureToggles;

    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingImportAlertmanagerUI: true };
      server.resetHandlers();
    });

    afterEach(() => {
      config.featureToggles = originalFeatureToggles;
      server.resetHandlers();
    });

    it('should throw error when K8s API returns failure status', async () => {
      server.use(
        createK8sTestHandler({
          response: { status: 'failure', error: 'Connection refused' },
        })
      );

      const contactPoint = createContactPoint();
      const channelValues = createChannelValues();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      let testPromise: Promise<unknown>;
      act(() => {
        testPromise = result.current.testChannel({ channelValues });
      });

      await expect(testPromise!).rejects.toThrow('Connection refused');
    });

    it('should throw generic error when failure has no error message', async () => {
      server.use(
        createK8sTestHandler({
          response: { status: 'failure' },
        })
      );

      const contactPoint = createContactPoint();
      const channelValues = createChannelValues();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      let testPromise: Promise<unknown>;
      act(() => {
        testPromise = result.current.testChannel({ channelValues });
      });

      await expect(testPromise!).rejects.toThrow('Test notification failed');
    });

    it('should propagate network errors', async () => {
      server.use(createK8sTestHandler({ networkError: true }));

      const contactPoint = createContactPoint();
      const channelValues = createChannelValues();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      let testPromise: Promise<unknown>;
      act(() => {
        testPromise = result.current.testChannel({ channelValues });
      });

      await expect(testPromise!).rejects.toThrow();
    });
  });

  describe('state management', () => {
    const originalFeatureToggles = config.featureToggles;

    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingImportAlertmanagerUI: true };
    });

    afterEach(() => {
      config.featureToggles = originalFeatureToggles;
      server.resetHandlers();
    });

    it('should set isLoading=true while request is in progress', async () => {
      let resolveRequest: () => void;
      const requestPromise = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(createK8sTestHandler({ waitFor: requestPromise }));

      const contactPoint = createContactPoint();
      const channelValues = createChannelValues();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      expect(result.current.isLoading).toBe(false);

      let testPromise: Promise<unknown>;
      await act(async () => {
        testPromise = result.current.testChannel({ channelValues });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      resolveRequest!();
      await act(async () => {
        await testPromise!;
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set isSuccess=true after successful test', async () => {
      server.use(createK8sTestHandler());

      const contactPoint = createContactPoint();
      const channelValues = createChannelValues();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      expect(result.current.isSuccess).toBe(false);

      await act(async () => {
        await result.current.testChannel({ channelValues });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should set error after failed API call', async () => {
      server.use(
        createK8sTestHandler({
          response: { message: 'Internal server error' } as unknown as Partial<TestIntegrationResponse>,
          status: 500,
        })
      );

      const contactPoint = createContactPoint();
      const channelValues = createChannelValues();

      const { result } = renderHook(() => useTestContactPoint({ contactPoint, defaultChannelValues }), {
        wrapper: wrapper(),
      });

      await act(async () => {
        try {
          await result.current.testChannel({ channelValues });
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });
  });
});
