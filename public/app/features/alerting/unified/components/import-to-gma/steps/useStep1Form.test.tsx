import { HttpResponse, http } from 'msw';
import { type PropsWithChildren } from 'react';
import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setupMswServer } from '../../../mockApi';
import { mimirAlertmanagerDataSourcePayload } from '../../../mocks/server/configure/datasources';
import { ALERTING_API_SERVER_BASE_URL } from '../../../mocks/server/utils';
import { useAutoSyncConfiguration } from '../../settings/useAutoSyncConfiguration';
import { mockImportFormValues } from '../testUtils';
import { type ImportFormValues } from '../types';

import { useAutoSyncPrediction } from './useAutoSyncPrediction';
import { useStep1Form } from './useStep1Form';

jest.mock('../../settings/useAutoSyncConfiguration');
jest.mock('./useAutoSyncPrediction');

const server = setupMswServer();
const StoreWrapper = getWrapper({ renderWithRouter: true });

const MIMIR = mimirAlertmanagerDataSourcePayload({ uid: 'mimir-uid', name: 'Mimir' });

function mockAutoSyncConfig({
  eligible = [MIMIR],
  isLoading = false,
}: { eligible?: Array<typeof MIMIR>; isLoading?: boolean } = {}) {
  jest.mocked(useAutoSyncConfiguration).mockReturnValue({
    state: { kind: 'unconfigured' },
    syncHealth: { kind: 'healthy' },
    autoSyncEligibleAlertmanagers: eligible,
    selectedUid: '',
    lastSyncedUid: '',
    setSelectedUid: jest.fn(),
    getSyncIdentifier: jest.fn(),
    predictSyncIdentifier: jest.fn(),
    save: jest.fn(),
    disableSync: jest.fn(),
    isPending: false,
    isLoading,
    isReady: true,
  });
}

function setup(values: Partial<ImportFormValues> = {}) {
  let form!: UseFormReturn<ImportFormValues>;
  let errors: UseFormReturn<ImportFormValues>['formState']['errors'] = {};
  function Wrapper({ children }: PropsWithChildren) {
    form = useForm<ImportFormValues>({ defaultValues: mockImportFormValues(values) });
    // Read during render, which is what makes the form track its errors.
    errors = form.formState.errors;
    return (
      <StoreWrapper>
        <FormProvider {...form}>{children}</FormProvider>
      </StoreWrapper>
    );
  }
  const view = renderHook(() => useStep1Form(), { wrapper: Wrapper });
  return { ...view, getForm: () => form, getErrors: () => errors };
}

async function validate(result: { current: ReturnType<typeof useStep1Form> }, name: string) {
  let outcome: string | true | undefined;
  await act(async () => {
    outcome = await result.current.validatePolicyTreeNameIsFree(name);
  });
  return outcome;
}

function routingTreeLookup(handler: (name: string) => Response) {
  server.use(
    http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees/:name`, ({ params }) =>
      handler(String(params.name))
    )
  );
}

const autoSyncValues: Partial<ImportFormValues> = {
  notificationsSource: 'datasource',
  notificationsDatasourceUID: MIMIR.uid,
  notificationsDatasourceName: MIMIR.name,
  autoSyncNotificationsEnabled: true,
};

beforeEach(() => {
  mockAutoSyncConfig();
  jest.mocked(useAutoSyncPrediction).mockReturnValue(undefined);
});

describe('useStep1Form', () => {
  describe('validatePolicyTreeNameIsFree', () => {
    it('rejects a name that is not a valid identifier', async () => {
      const { result } = setup();

      expect(await validate(result, 'Not Valid')).toContain('lowercase alphanumeric');
    });

    it('rejects the name reserved for the default policy', async () => {
      const { result } = setup();

      expect(await validate(result, 'default')).toContain('reserved');
    });

    it('rejects a name a policy tree already has', async () => {
      routingTreeLookup((name) => HttpResponse.json({ metadata: { name }, spec: { defaults: {}, routes: [] } }));
      const { result } = setup();

      expect(await validate(result, 'taken')).toContain('already exists');
    });

    it('accepts a name no policy tree has', async () => {
      routingTreeLookup(() => HttpResponse.json({ message: 'NotFound' }, { status: 404 }));
      const { result } = setup();

      expect(await validate(result, 'free-name')).toBe(true);
    });

    it('does not block the user when the lookup itself fails', async () => {
      routingTreeLookup(() => HttpResponse.json({ message: 'boom' }, { status: 500 }));
      const { result } = setup();

      expect(await validate(result, 'any-name')).toBe(true);
    });
  });

  describe('handlePolicyTreeNameBlur', () => {
    it('validates the name', async () => {
      const { result, getForm, getErrors } = setup();
      getForm().register('policyTreeName', { validate: () => 'not allowed' });

      await act(async () => {
        await result.current.handlePolicyTreeNameBlur();
      });

      expect(getErrors().policyTreeName?.message).toBe('not allowed');
    });
  });

  describe('Auto-sync', () => {
    it('is active only for the data source source with the switch on', () => {
      expect(setup(autoSyncValues).result.current.autoSyncActive).toBe(true);
      expect(setup({ ...autoSyncValues, autoSyncNotificationsEnabled: false }).result.current.autoSyncActive).toBe(
        false
      );
      expect(setup({ ...autoSyncValues, notificationsSource: 'yaml' }).result.current.autoSyncActive).toBe(false);
    });

    it('drops a leftover name error once Auto-sync takes over the name field', async () => {
      const { result, getForm, getErrors } = setup({ ...autoSyncValues, autoSyncNotificationsEnabled: false });
      act(() => getForm().setError('policyTreeName', { message: 'taken' }));
      expect(getErrors().policyTreeName).toBeDefined();

      act(() => getForm().setValue('autoSyncNotificationsEnabled', true));

      await waitFor(() => expect(getErrors().policyTreeName).toBeUndefined());
      expect(result.current.autoSyncActive).toBe(true);
    });

    it('knows whether the selected data source can sync', () => {
      expect(setup(autoSyncValues).result.current.isSelectedDatasourceAutoSyncCapable).toBe(true);

      mockAutoSyncConfig({ eligible: [] });
      expect(setup(autoSyncValues).result.current.isSelectedDatasourceAutoSyncCapable).toBe(false);
    });

    it('unchecks the switch when the selected data source cannot sync', async () => {
      mockAutoSyncConfig({ eligible: [] });
      const { getForm } = setup(autoSyncValues);

      await waitFor(() => expect(getForm().getValues('autoSyncNotificationsEnabled')).toBe(false));
    });

    it('keeps the switch checked while the list of syncable data sources is still loading', async () => {
      mockAutoSyncConfig({ eligible: [], isLoading: true });
      const { result, getForm } = setup(autoSyncValues);

      expect(result.current.isSelectedDatasourceAutoSyncCapable).toBe(false);
      await act(() => Promise.resolve());
      expect(getForm().getValues('autoSyncNotificationsEnabled')).toBe(true);
    });

    it('keeps the switch checked for a data source that can sync', async () => {
      const { getForm } = setup(autoSyncValues);

      await act(() => Promise.resolve());
      expect(getForm().getValues('autoSyncNotificationsEnabled')).toBe(true);
    });

    it('reports the name the sync will pick', () => {
      jest.mocked(useAutoSyncPrediction).mockReturnValue({ identifier: 'mimir-sync' });
      const { result } = setup(autoSyncValues);

      expect(result.current.autoSyncIdentifier).toBe('mimir-sync');
      expect(result.current.autoSyncConflictMessage).toBeUndefined();
    });

    it('explains a name a policy tree already uses', () => {
      jest.mocked(useAutoSyncPrediction).mockReturnValue({ identifier: 'mimir', conflict: 'policy-tree' });
      const { result } = setup(autoSyncValues);

      expect(result.current.autoSyncConflictMessage).toContain('which a policy tree already uses');
    });

    it('explains a name reserved for the default policy', () => {
      jest.mocked(useAutoSyncPrediction).mockReturnValue({ identifier: 'default', conflict: 'reserved' });
      const { result } = setup(autoSyncValues);

      expect(result.current.autoSyncConflictMessage).toContain('reserved for the default policy');
    });
  });

  describe('duplicateTemplateFileName', () => {
    it('names a template file uploaded twice', () => {
      const files = [new File(['a'], 'same.tmpl'), new File(['b'], 'same.tmpl')];

      expect(setup({ notificationsTemplateFiles: files }).result.current.duplicateTemplateFileName).toBe('same.tmpl');
    });

    it('is empty when every template file has its own name', () => {
      const files = [new File(['a'], 'one.tmpl'), new File(['b'], 'two.tmpl')];

      expect(setup({ notificationsTemplateFiles: files }).result.current.duplicateTemplateFileName).toBeUndefined();
    });
  });
});
