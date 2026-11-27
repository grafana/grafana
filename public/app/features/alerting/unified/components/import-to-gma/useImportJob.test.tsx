import { HttpResponse, delay, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { locationService, reportInteraction } from '@grafana/runtime';
import { type RulerCloudRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import { convertResponse } from '../../mocks/convertApi';
import { ALERTING_IMPORT_SETTINGS_URL } from '../../settings/navigation';
import { createListFilterLink } from '../../utils/navigation';

import { type ImportPlan } from './Wizard/steps';
import { useRulesToImport } from './hooks';
import { buildRulesImportSpec } from './steps/utils';
import { mockImportFormValues } from './testUtils';
import { type ImportFormValues } from './types';
import { getPostImportOutcome, useImportJob } from './useImportJob';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const mockNotify = { success: jest.fn(), warning: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => mockNotify,
}));

const server = setupMswServer();
const RULES_URL = '/api/convert/prometheus/config/v1/rules';

const wrapper = getWrapper({ renderWithRouter: true });

// Rules step completed against a data source, nothing from the notifications step.
const baseValues = mockImportFormValues({
  step2Completed: true,
  selectedRoutingTree: 'imported',
  targetDatasourceUID: 'prometheus-uid',
  rulesDatasourceUID: 'prometheus-uid',
  rulesDatasourceName: 'Prometheus',
});

const rulesToImport: RulerCloudRulesConfigDTO = {
  'ns-a': [{ name: 'group-a', rules: [{ alert: 'Kept', expr: 'up == 0' }] }],
};

function setup(values: Partial<ImportFormValues> = {}, liveLock?: 'auto-sync' | 'staged' | 'import-api-disabled') {
  const importValues = { ...baseValues, ...values };
  const getImportValues = () => importValues;
  const rulesSpec = buildRulesImportSpec(importValues);
  return renderHook(
    ({ lock }: { lock?: 'auto-sync' | 'staged' | 'import-api-disabled' }) =>
      useImportJob({ getImportValues, rulesSpec, rulesToImport, liveNotificationsLock: lock }),
    { wrapper, initialProps: { lock: liveLock } }
  );
}

function captureRequests() {
  const seen: { rules: Request[]; rulesBodies: unknown[] } = { rules: [], rulesBodies: [] };
  server.use(
    http.post(RULES_URL, async ({ request }) => {
      seen.rules.push(request.clone());
      seen.rulesBodies.push(await request.json());
      return HttpResponse.json(convertResponse());
    })
  );
  return seen;
}

let pushSpy: jest.SpyInstance;
beforeEach(() => {
  jest.mocked(reportInteraction).mockClear();
  Object.values(mockNotify).forEach((fn) => fn.mockClear());
  pushSpy = jest.spyOn(locationService, 'push').mockImplementation(() => {});
});
afterEach(() => pushSpy.mockRestore());

describe('getPostImportOutcome', () => {
  const plan = (overrides: Partial<ImportPlan>): ImportPlan => ({
    willEnableAutoSync: false,
    willImportNotifications: false,
    willImportRules: false,
    ...overrides,
  });

  it('sends Auto-sync to the Import tab, with the sync copy', () => {
    const outcome = getPostImportOutcome(plan({ willEnableAutoSync: true }), undefined);

    expect(outcome).toEqual({
      title: 'Auto-sync enabled',
      body: 'Grafana will keep syncing alert configuration from this data source.',
      redirectTo: ALERTING_IMPORT_SETTINGS_URL,
    });
  });

  it('mentions the rules when Auto-sync was enabled together with a rules import', () => {
    const outcome = getPostImportOutcome(plan({ willEnableAutoSync: true, willImportRules: true }), undefined);

    expect(outcome.body).toBe(
      'Grafana will keep syncing alert configuration from this data source. Your alert rules were also imported.'
    );
  });

  it('sends a staged notifications import to the Import tab so it can be promoted or reverted', () => {
    const outcome = getPostImportOutcome(plan({ willImportNotifications: true }), undefined);

    expect(outcome).toEqual({
      title: 'Configuration staged',
      body: 'Your imported config is now staged in the Import tab.',
      redirectTo: ALERTING_IMPORT_SETTINGS_URL,
    });
  });

  it('prefers the staged notifications copy over the rules redirect when both are imported', () => {
    const outcome = getPostImportOutcome(plan({ willImportNotifications: true, willImportRules: true }), undefined);

    expect(outcome.redirectTo).toBe(ALERTING_IMPORT_SETTINGS_URL);
  });

  it('sends a rules-only import to the whole rule list when the target is the root folder', () => {
    const outcome = getPostImportOutcome(plan({ willImportRules: true }), undefined);

    expect(outcome).toEqual({
      title: 'Successfully imported resources to Grafana Alerting.',
      redirectTo: createListFilterLink([], { skipSubPath: true }),
    });
  });

  it('filters the rule list by the target folder for a rules-only import', () => {
    const folder = { uid: 'folder-uid', title: 'Imported rules' };
    const outcome = getPostImportOutcome(plan({ willImportRules: true }), folder);

    expect(outcome.redirectTo).toBe(createListFilterLink([['namespace', 'Imported rules']], { skipSubPath: true }));
    expect(outcome.redirectTo).not.toBe(createListFilterLink([], { skipSubPath: true }));
  });
});

describe('useImportJob', () => {
  describe('closeConfirm', () => {
    it('keeps the success state on screen until the user moves on, then toasts and redirects', async () => {
      captureRequests();
      const { result } = setup();
      act(() => result.current.startImport());
      await act(async () => {
        await result.current.confirmImport();
      });

      expect(result.current.importStatus).toBe('success');
      expect(result.current.showConfirmModal).toBe(true);
      expect(pushSpy).not.toHaveBeenCalled();

      act(() => result.current.closeConfirm());

      expect(pushSpy).toHaveBeenCalledWith(createListFilterLink([], { skipSubPath: true }));
      expect(mockNotify.success).toHaveBeenCalledWith(
        'Successfully imported resources to Grafana Alerting.',
        undefined
      );
      expect(result.current.showConfirmModal).toBe(false);
    });

    it('does nothing while the import is running', async () => {
      server.use(
        http.post(RULES_URL, async () => {
          await delay(300);
          return HttpResponse.json(convertResponse());
        })
      );
      const { result } = setup();
      act(() => result.current.startImport());

      let pending: Promise<void> | undefined;
      act(() => {
        pending = result.current.confirmImport();
      });
      await waitFor(() => expect(result.current.importStatus).toBe('importing'));

      act(() => result.current.closeConfirm());
      expect(result.current.showConfirmModal).toBe(true);
      expect(result.current.importStatus).toBe('importing');
      expect(pushSpy).not.toHaveBeenCalled();

      await act(async () => {
        await pending;
      });
    });
  });

  describe('notificationsLock', () => {
    it('follows the live lock while idle', () => {
      const { result, rerender } = setup({}, undefined);
      expect(result.current.notificationsLock).toBeUndefined();

      rerender({ lock: 'staged' });
      expect(result.current.notificationsLock).toBe('staged');

      rerender({ lock: undefined });
      expect(result.current.notificationsLock).toBeUndefined();
    });

    it('keeps the lock the import started with until it is done', async () => {
      server.use(
        http.post(RULES_URL, async () => {
          await delay(300);
          return HttpResponse.json(convertResponse());
        })
      );
      const { result, rerender } = setup({}, undefined);

      let pending: Promise<void> | undefined;
      act(() => {
        pending = result.current.confirmImport();
      });
      await waitFor(() => expect(result.current.importStatus).toBe('importing'));

      // The import itself turned the lock on (e.g. it staged a copy), but the step must not be swapped yet.
      rerender({ lock: 'staged' });
      expect(result.current.notificationsLock).toBeUndefined();

      await act(async () => {
        await pending;
      });
      expect(result.current.notificationsLock).toBeUndefined();

      // The redirect keeps the wizard mounted when it lands on the Import tab, so it has to catch up.
      act(() => result.current.closeConfirm());
      expect(result.current.notificationsLock).toBe('staged');
    });
  });
});

describe('useImportJob — rules from a YAML file', () => {
  const yamlRules = {
    rulesSource: 'yaml' as const,
    rulesYamlFile: new File(['groups: []'], 'rules.yaml'),
    rulesDatasourceUID: undefined,
    rulesDatasourceName: null,
    yamlImportTargetDatasourceUID: 'yaml-target-uid',
  };

  it('sends them to the data source chosen for the file', async () => {
    const requests = captureRequests();
    const { result } = setup(yamlRules);

    await act(async () => {
      await result.current.confirmImport();
    });

    expect(result.current.importStatus).toBe('success');
    expect(requests.rules).toHaveLength(1);
    expect(requests.rules[0].headers.get('X-Grafana-Alerting-Datasource-UID')).toBe('yaml-target-uid');
    expect(requests.rulesBodies[0]).toEqual(rulesToImport);
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_alerting_import_to_gma_success',
      expect.objectContaining({ rulesSource: 'yaml' })
    );
  });

  it('uses the data source of a data source import, not a YAML target left over from before', async () => {
    const requests = captureRequests();
    const { result } = setup({
      rulesSource: 'datasource',
      rulesDatasourceUID: 'prometheus-uid',
      yamlImportTargetDatasourceUID: 'yaml-target-uid',
    });

    await act(async () => {
      await result.current.confirmImport();
    });

    expect(requests.rules).toHaveLength(1);
    expect(requests.rules[0].headers.get('X-Grafana-Alerting-Datasource-UID')).toBe('prometheus-uid');
  });

  it('imports what the spec describes, whatever the form values say', async () => {
    const requests = captureRequests();
    const rulesSpec = buildRulesImportSpec({
      ...baseValues,
      rulesDatasourceUID: 'spec-uid',
      targetFolder: { uid: 'spec-folder', title: 'Spec folder' },
      pauseAlertingRules: false,
    });
    const getImportValues = () => ({
      ...baseValues,
      rulesDatasourceUID: 'form-uid',
      targetFolder: { uid: 'form-folder', title: 'Form folder' },
      pauseAlertingRules: true,
    });
    const { result } = renderHook(
      () => useImportJob({ getImportValues, rulesSpec, rulesToImport, liveNotificationsLock: undefined }),
      { wrapper }
    );

    await act(async () => {
      await result.current.confirmImport();
    });

    const headers = requests.rules[0].headers;
    expect(headers.get('X-Grafana-Alerting-Datasource-UID')).toBe('spec-uid');
    expect(headers.get('X-Grafana-Alerting-Folder-UID')).toBe('spec-folder');
    expect(headers.get('X-Grafana-Alerting-Alert-Rules-Paused')).toBe('false');
  });

  it('reports the rule settings of the form even when no rules are imported', async () => {
    const getImportValues = () => ({
      ...baseValues,
      step2Completed: false,
      namespace: 'ns',
      ruleGroup: 'group',
      targetFolder: { uid: 'folder-uid', title: 'Folder' },
      pauseAlertingRules: false,
      pauseRecordingRules: true,
    });
    const { result } = renderHook(
      () => useImportJob({ getImportValues, rulesSpec: undefined, rulesToImport, liveNotificationsLock: undefined }),
      { wrapper }
    );

    await act(async () => {
      await result.current.confirmImport();
    });

    expect(reportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_success', {
      isRootFolder: false,
      namespace: 'ns',
      ruleGroup: 'group',
      pauseAlertingRules: false,
      pauseRecordingRules: true,
    });
  });

  it('does not import rules when there is no spec for them', async () => {
    const requests = captureRequests();
    const { result } = renderHook(
      () =>
        useImportJob({
          getImportValues: () => baseValues,
          rulesSpec: undefined,
          rulesToImport,
          liveNotificationsLock: undefined,
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.confirmImport();
    });

    expect(requests.rules).toHaveLength(0);
  });

  it('ignores a data source left over from before the source was switched to YAML', async () => {
    const requests = captureRequests();
    const { result } = setup({ ...yamlRules, rulesDatasourceUID: 'prometheus-uid', rulesDatasourceName: 'Prometheus' });

    await act(async () => {
      await result.current.confirmImport();
    });

    expect(requests.rules).toHaveLength(1);
    expect(requests.rules[0].headers.get('X-Grafana-Alerting-Datasource-UID')).toBe('yaml-target-uid');
  });
});

describe('rules read from a YAML file', () => {
  const rulesFile = (alert: string) =>
    new File([`groups:\n  - name: g\n    rules:\n      - alert: ${alert}\n        expr: up == 0\n`], 'rules.yaml');
  const alertsOf = (rules: RulerCloudRulesConfigDTO) =>
    Object.values(rules).flatMap((groups) =>
      groups.flatMap((group) => group.rules.flatMap((rule) => ('alert' in rule ? [rule.alert] : [])))
    );
  const useYamlRules = (rulesYamlFile: File) =>
    useRulesToImport({
      rulesSource: 'yaml',
      rulesDatasourceName: undefined,
      rulesYamlFile,
      namespace: undefined,
      ruleGroup: undefined,
      targetFolder: undefined,
    });

  it('is pending, with nothing to import, until the file has been read', async () => {
    const file = rulesFile('FromYaml');
    const { result } = renderHook(() => useYamlRules(file), { wrapper });

    expect(result.current.isLoadingRules).toBe(true);
    await waitFor(() => expect(result.current.isLoadingRules).toBe(false));
    expect(alertsOf(result.current.rulesToBeImported)).toEqual(['FromYaml']);
  });

  it('does not hand out the rules of the previous file while the new one is read', async () => {
    let file = rulesFile('First');
    const { result, rerender } = renderHook(() => useYamlRules(file), { wrapper });
    await waitFor(() => expect(result.current.isLoadingRules).toBe(false));

    file = rulesFile('Second');
    rerender();

    expect(result.current.isLoadingRules).toBe(true);
    await waitFor(() => expect(result.current.isLoadingRules).toBe(false));
    expect(alertsOf(result.current.rulesToBeImported)).toEqual(['Second']);
  });
});
