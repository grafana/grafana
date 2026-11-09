import { HttpResponse, delay, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { locationService, reportInteraction } from '@grafana/runtime';
import { type RulerCloudRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import { convertResponse } from '../../mocks/convertApi';
import { ALERTING_IMPORT_SETTINGS_URL } from '../../settings/navigation';
import { createListFilterLink } from '../../utils/navigation';

import { type ImportPlan } from './Wizard/steps';
import { mockImportFormValues } from './testUtils';
import { type ImportFormValues } from './types';
import { getPostImportOutcome, useRunImport } from './useRunImport';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const mockNotify = { success: jest.fn(), warning: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => mockNotify,
}));

const mockSaveAutoSync = jest.fn();
jest.mock('../settings/useAutoSyncConfiguration', () => ({
  useAutoSyncConfiguration: () => ({ save: mockSaveAutoSync }),
}));

const server = setupMswServer();
const NOTIFICATIONS_URL = '/api/convert/api/v1/alerts';
const RULES_URL = '/api/convert/prometheus/config/v1/rules';
const REDIRECT_DELAY_WAIT = { timeout: 4000 };

const wrapper = getWrapper({ renderWithRouter: true });

// Rules step completed against a data source, nothing from the notifications step.
const baseValues = mockImportFormValues({
  step2Completed: true,
  selectedRoutingTree: 'imported',
  rulesDatasourceUID: 'prometheus-uid',
  rulesDatasourceName: 'Prometheus',
});

const rulesToImport: RulerCloudRulesConfigDTO = {
  'ns-a': [{ name: 'group-a', rules: [{ alert: 'Kept', expr: 'up == 0' }] }],
};

const yamlFile = () => new File(['route:\n  receiver: default\nreceivers:\n  - name: default\n'], 'am.yaml');

function setup(values: Partial<ImportFormValues> = {}, liveLock?: 'auto-sync' | 'staged' | 'import-api-disabled') {
  const getImportValues = () => ({ ...baseValues, ...values });
  return renderHook(
    ({ lock }: { lock?: 'auto-sync' | 'staged' | 'import-api-disabled' }) =>
      useRunImport({ getImportValues, rulesToImport, liveNotificationsLock: lock }),
    { wrapper, initialProps: { lock: liveLock } }
  );
}

function captureRequests() {
  const seen: { notifications: Request[]; rules: Request[]; rulesBodies: unknown[] } = {
    notifications: [],
    rules: [],
    rulesBodies: [],
  };
  server.use(
    http.post(NOTIFICATIONS_URL, ({ request }) => {
      seen.notifications.push(request.clone());
      return HttpResponse.json(convertResponse());
    }),
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
  mockSaveAutoSync.mockReset();
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

describe('useRunImport', () => {
  describe('confirmImport', () => {
    it('imports the filtered rules, then reports success and goes to the rule list after a beat', async () => {
      const requests = captureRequests();
      const { result } = setup();

      act(() => result.current.startImport());
      expect(result.current.showConfirmModal).toBe(true);
      await act(async () => {
        await result.current.confirmImport();
      });

      expect(result.current.importStatus).toBe('success');
      expect(requests.rules).toHaveLength(1);
      expect(requests.rulesBodies[0]).toEqual(rulesToImport);
      expect(requests.rules[0].headers.get('X-Grafana-Alerting-Datasource-UID')).toBe('prometheus-uid');
      expect(requests.notifications).toHaveLength(0);
      expect(reportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_success',
        expect.objectContaining({ rulesSource: 'datasource', isRootFolder: true })
      );
      // The confirmation stays on screen for a moment so the user sees it succeed.
      expect(pushSpy).not.toHaveBeenCalled();
      expect(result.current.showConfirmModal).toBe(true);

      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith(createListFilterLink([], { skipSubPath: true })), {
        ...REDIRECT_DELAY_WAIT,
      });
      expect(mockNotify.success).toHaveBeenCalledWith(
        'Successfully imported resources to Grafana Alerting.',
        undefined
      );
      expect(result.current.showConfirmModal).toBe(false);
    });

    it('stages a notifications import and sends the user to the Import tab', async () => {
      const requests = captureRequests();
      const { result } = setup({
        step1Completed: true,
        policyTreeName: 'imported',
        notificationsYamlFile: yamlFile(),
        step2Completed: false,
        step2Skipped: true,
      });

      await act(async () => {
        await result.current.confirmImport();
      });

      expect(requests.notifications).toHaveLength(1);
      expect(requests.notifications[0].headers.get('X-Grafana-Alerting-Config-Identifier')).toBe('imported');
      expect(requests.rules).toHaveLength(0);
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith(ALERTING_IMPORT_SETTINGS_URL), REDIRECT_DELAY_WAIT);
      expect(mockNotify.success).toHaveBeenCalledWith(
        'Configuration staged',
        'Your imported config is now staged in the Import tab.'
      );
    });

    it('turns Auto-sync on without importing notifications, and still imports the rules', async () => {
      mockSaveAutoSync.mockResolvedValue(true);
      const requests = captureRequests();
      const { result } = setup({
        step1Completed: true,
        notificationsSource: 'datasource',
        notificationsDatasourceUID: 'mimir-uid',
        notificationsDatasourceName: 'Mimir',
        autoSyncNotificationsEnabled: true,
      });

      await act(async () => {
        await result.current.confirmImport();
      });

      expect(mockSaveAutoSync).toHaveBeenCalledWith('mimir-uid', { silent: true });
      expect(requests.notifications).toHaveLength(0);
      expect(requests.rules).toHaveLength(1);
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith(ALERTING_IMPORT_SETTINGS_URL), REDIRECT_DELAY_WAIT);
      expect(mockNotify.success).toHaveBeenCalledWith(
        'Auto-sync enabled',
        expect.stringContaining('Your alert rules were also imported.')
      );
    });

    it('stops with an error, without importing rules, when Auto-sync could not be turned on', async () => {
      mockSaveAutoSync.mockResolvedValue(false);
      const requests = captureRequests();
      const { result } = setup({
        step1Completed: true,
        notificationsSource: 'datasource',
        notificationsDatasourceUID: 'mimir-uid',
        autoSyncNotificationsEnabled: true,
      });

      await act(async () => {
        await result.current.confirmImport();
      });

      expect(result.current.importStatus).toBe('error');
      expect(result.current.importError).toBeUndefined();
      expect(requests.rules).toHaveLength(0);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_error', {
        notificationsSource: 'datasource',
      });
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('reports an error with what the request said when the import fails', async () => {
      server.use(http.post(RULES_URL, () => HttpResponse.json({ message: 'rules rejected' }, { status: 400 })));
      const { result } = setup();

      await act(async () => {
        await result.current.confirmImport();
      });

      expect(result.current.importStatus).toBe('error');
      expect(result.current.importError).toEqual(expect.stringContaining('rules rejected'));
      expect(reportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_error', {
        rulesSource: 'datasource',
      });
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('reports a partial error when the rules fail after Auto-sync was already turned on', async () => {
      mockSaveAutoSync.mockResolvedValue(true);
      server.use(http.post(RULES_URL, () => HttpResponse.json({ message: 'rules rejected' }, { status: 400 })));
      const { result } = setup({
        step1Completed: true,
        notificationsSource: 'datasource',
        notificationsDatasourceUID: 'mimir-uid',
        autoSyncNotificationsEnabled: true,
      });

      await act(async () => {
        await result.current.confirmImport();
      });

      expect(result.current.importStatus).toBe('partial-error');
    });

    it('clears the earlier error when the import is tried again', async () => {
      server.use(http.post(RULES_URL, () => HttpResponse.json({ message: 'rules rejected' }, { status: 400 })));
      const { result } = setup();
      await act(async () => {
        await result.current.confirmImport();
      });
      expect(result.current.importError).toBeDefined();

      server.use(http.post(RULES_URL, () => HttpResponse.json(convertResponse())));
      await act(async () => {
        await result.current.confirmImport();
      });

      expect(result.current.importError).toBeUndefined();
      expect(result.current.importStatus).toBe('success');
    });
  });

  describe('cancelConfirm', () => {
    it('closes the confirmation and goes back to idle', async () => {
      server.use(http.post(RULES_URL, () => HttpResponse.json({ message: 'nope' }, { status: 400 })));
      const { result } = setup();
      act(() => result.current.startImport());
      await act(async () => {
        await result.current.confirmImport();
      });
      expect(result.current.importStatus).toBe('error');

      act(() => result.current.cancelConfirm());

      expect(result.current.showConfirmModal).toBe(false);
      expect(result.current.importStatus).toBe('idle');
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

      act(() => result.current.cancelConfirm());
      expect(result.current.showConfirmModal).toBe(true);
      expect(result.current.importStatus).toBe('importing');

      await act(async () => {
        await pending;
      });
    });
  });

  describe('redirect timer', () => {
    it('does not redirect once the wizard has been left', async () => {
      captureRequests();
      const { result, unmount } = setup();
      await act(async () => {
        await result.current.confirmImport();
      });

      unmount();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1800));
      });

      expect(pushSpy).not.toHaveBeenCalled();
      expect(mockNotify.success).not.toHaveBeenCalled();
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

      // Once the user dismisses the confirmation the wizard is idle again and catches up.
      act(() => result.current.cancelConfirm());
      expect(result.current.notificationsLock).toBe('staged');
    });
  });
});
