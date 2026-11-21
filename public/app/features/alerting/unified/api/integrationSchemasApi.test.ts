import { HttpResponse, http } from 'msw';
import { getWrapper, renderHook, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { type GetIntegrationtypeschemasField } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

import { setupMswServer } from '../mockApi';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from '../mocks/server/utils';
import { type NotificationChannelOption, type NotifierDTO } from '../types/alerting';

import { useIntegrationTypeSchemas } from './integrationSchemasApi';

const server = setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

const secureHeaderSchemaOption: NotificationChannelOption = {
  element: 'subform',
  inputType: '',
  label: 'HTTP config',
  description: '',
  placeholder: '',
  propertyName: 'http_config',
  required: false,
  secure: false,
  showWhen: { field: '', is: '' },
  validationRule: '',
  dependsOn: '',
  subformOptions: [
    {
      element: 'key_value_object_map',
      inputType: '',
      label: 'HTTP headers',
      description: '',
      placeholder: '',
      propertyName: 'http_headers',
      required: false,
      secure: false,
      showWhen: { field: '', is: '' },
      validationRule: '',
      dependsOn: '',
      subformOptions: [
        {
          element: 'string_array',
          inputType: 'password',
          label: 'Secrets',
          description: '',
          placeholder: '',
          propertyName: 'secrets',
          required: false,
          secure: true,
          showWhen: { field: '', is: '' },
          validationRule: '',
          dependsOn: '',
        },
      ],
    },
  ],
};

function toK8sField(option: NotificationChannelOption): GetIntegrationtypeschemasField {
  return {
    element: option.element,
    inputType: option.inputType,
    label: option.label,
    description: option.description,
    placeholder: option.placeholder,
    propertyName: option.propertyName,
    required: option.required,
    secure: option.secure,
    protected: option.protected,
    showWhen: { field: option.showWhen.field, is: String(option.showWhen.is) },
    validationRule: option.validationRule,
    dependsOn: option.dependsOn,
    subformOptions: option.subformOptions?.map(toK8sField),
  };
}

describe('useIntegrationTypeSchemas', () => {
  describe('with alertingSyncNotifiersApiMigration flag disabled', () => {
    testWithFeatureToggles({ disable: ['alertingSyncNotifiersApiMigration'] });

    it('does not assign a static secure key to fields inside an object map', async () => {
      const notifier: NotifierDTO = {
        type: 'webhook',
        name: 'Webhook',
        heading: 'Webhook',
        description: '',
        options: [secureHeaderSchemaOption],
      };
      server.use(http.get('/api/alert-notifiers', () => HttpResponse.json([notifier])));

      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(
        result.current.data?.[0].options?.[0].subformOptions?.[0].subformOptions?.[0].secureFieldKey
      ).toBeUndefined();
    });

    it('should return data from legacy API', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.length).toBeGreaterThan(0);
      // Legacy API returns notifiers with top-level options
      expect(result.current.data?.[0].options).toBeDefined();
    });
  });

  describe('with alertingSyncNotifiersApiMigration flag enabled', () => {
    testWithFeatureToggles({ enable: ['alertingSyncNotifiersApiMigration'] });

    it('does not assign a static secure key to fields inside an object map', async () => {
      const item = {
        metadata: { name: 'webhook', namespace: 'default' },
        spec: {
          type: 'webhook',
          name: 'Webhook',
          heading: 'Webhook',
          description: '',
          currentVersion: 'v1',
          versions: [{ version: 'v1', canCreate: true, options: [toK8sField(secureHeaderSchemaOption)] }],
        },
      };
      server.use(
        http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/integrationtypeschemas`, () =>
          HttpResponse.json(getK8sResponse('IntegrationTypeSchemaList', [item]))
        )
      );

      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(
        result.current.data?.[0].versions?.[0].options[0].subformOptions?.[0].subformOptions?.[0].secureFieldKey
      ).toBeUndefined();
    });

    it('should return data from new k8s API', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.length).toBeGreaterThan(0);
    });

    it('should transform response to NotifierDTO format with versions', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const notifier = result.current.data?.[0];
      expect(notifier).toBeDefined();
      expect(notifier?.type).toBeDefined();
      expect(notifier?.name).toBeDefined();
      expect(notifier?.versions).toBeDefined();
      expect(notifier?.versions?.length).toBeGreaterThan(0);
    });

    it('should populate secureFieldKey on secure options', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Find a notifier with secure options
      const notifierWithSecure = result.current.data?.find((n) =>
        n.versions?.some((v) => v.options.some((o) => o.secure))
      );
      expect(notifierWithSecure).toBeDefined();

      const secureOption = notifierWithSecure!.versions?.flatMap((v) => v.options).find((o) => o.secure);
      expect(secureOption?.secureFieldKey).toBe(secureOption?.propertyName);
    });

    it('should handle nested subformOptions with correct secureFieldKey paths', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Find a notifier with subformOptions that contain a secure option
      const notifierWithSecureSubform = result.current.data?.find((n) =>
        n.versions?.some((v) => v.options.some((o) => o.subformOptions?.some((sub) => sub.secure)))
      );
      expect(notifierWithSecureSubform).toBeDefined();

      const optionWithSubform = notifierWithSecureSubform!.versions
        ?.flatMap((v) => v.options)
        .find((o) => o.subformOptions?.some((sub) => sub.secure));
      expect(optionWithSubform).toBeDefined();

      const secureSubOption = optionWithSubform!.subformOptions?.find((o) => o.secure);
      expect(secureSubOption).toBeDefined();

      // secureFieldKey should include parent path
      expect(secureSubOption!.secureFieldKey).toContain(optionWithSubform!.propertyName);
    });
  });

  describe('skip option', () => {
    it('should not fetch when skip is true', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas({ skip: true }), {
        wrapper: wrapper(),
      });

      // Should remain in initial state
      expect(result.current.data).toBeUndefined();
    });
  });
});
