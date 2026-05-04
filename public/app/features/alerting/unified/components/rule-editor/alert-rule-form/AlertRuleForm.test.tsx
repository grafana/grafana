import { produce } from 'immer';
import { HttpResponse, http } from 'msw';
import * as React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { screen, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { locationService, setPluginLinksHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { PROMETHEUS_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { AccessControlAction } from 'app/types/accessControl';
import {
  type GrafanaAlertStateDecision,
  type RulerGrafanaRuleDTO,
  type RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { grantUserPermissions, mockDataSource, mockFolder } from '../../../mocks';
import { grafanaRulerGroup, grafanaRulerRule, mockPreviewApiResponse } from '../../../mocks/grafanaRulerApi';
import {
  setCreateGrafanaRuleResolver,
  setFolderResponse,
  setReplaceGrafanaRuleResolver,
  setUpdateGrafanaRulerRuleNamespaceResolver,
} from '../../../mocks/server/configure';
import { setupDataSources } from '../../../testSetup/datasources';
import { NO_GROUP_PREFIX } from '../../../utils/rules';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(60 * 1000);

const server = setupMswServer();

const dataSources = {
  default: mockDataSource(
    {
      type: 'prometheus',
      name: 'Prom',
      uid: PROMETHEUS_DATASOURCE_UID,
      isDefault: true,
    },
    { alerting: true, module: 'core:plugin/prometheus' }
  ),
};

setupDataSources(dataSources.default);

setPluginLinksHook(() => ({ links: [], isLoading: false }));

const ALERTING_PERMISSIONS = [
  AccessControlAction.AlertingRuleRead,
  AccessControlAction.AlertingRuleUpdate,
  AccessControlAction.AlertingRuleDelete,
  AccessControlAction.AlertingRuleCreate,
  AccessControlAction.DataSourcesRead,
  AccessControlAction.DataSourcesWrite,
  AccessControlAction.DataSourcesCreate,
  AccessControlAction.FoldersWrite,
  AccessControlAction.FoldersRead,
  AccessControlAction.AlertingRuleExternalRead,
  AccessControlAction.AlertingRuleExternalWrite,
];

const grantAlertingPermissions = () => {
  jest.clearAllMocks();
  contextSrv.isEditor = true;
  contextSrv.hasEditPermissionInFolders = true;
  grantUserPermissions(ALERTING_PERMISSIONS);
};

const APP_PLATFORM_ALERTRULES_BASE = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/alertrules';
const APP_PLATFORM_RECORDINGRULES_BASE = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules';
const LEGACY_RULER_BASE = '/api/ruler/grafana/api/v1/rules/';

type EvaluationMode = 'new' | 'legacy';

const fillRuleBasics = async (user: ReturnType<typeof renderRuleEditor>['user']) => {
  await user.type(await ui.inputs.name.find(), 'my new rule');
  await user.click(await screen.findByRole('button', { name: /select folder/i }));
  await user.click(await screen.findByLabelText('Folder A'));
  await user.type(ui.inputs.annotationValue(1).get(), 'some description');
};

const selectLegacyGroup = async (user: ReturnType<typeof renderRuleEditor>['user']) => {
  await user.click(await screen.findByRole('radio', { name: /use groups \(legacy\)/i }));
  const groupInput = await ui.inputs.group.find();
  await user.click(await byRole('combobox').find(groupInput));
  await clickSelectOption(groupInput, grafanaRulerGroup.name);
};

const switchToNewMode = async (user: ReturnType<typeof renderRuleEditor>['user']) => {
  await user.click(await screen.findByRole('radio', { name: /set interval/i }));
};

const echoBodyResolver = async ({ request, params }: { request: Request; params: Record<string, string> }) => {
  // Clone before reading: captureRequests reads the body too, and a Request body can only be consumed once.
  const body = await request.clone().json();
  return HttpResponse.json({ ...(body as object), metadata: { name: params.name ?? 'new-uid' } });
};

const overrideRulerRule = (rule: RulerGrafanaRuleDTO) => {
  server.use(http.get(`/api/ruler/grafana/api/v1/rule/${rule.grafana_alert.uid}`, () => HttpResponse.json(rule)));
};

const overrideRulerRuleGroup = (folderUid: string, group: RulerRuleGroupDTO<RulerGrafanaRuleDTO>) => {
  server.use(http.get(`/api/ruler/grafana/api/v1/rules/${folderUid}/${group.name}`, () => HttpResponse.json(group)));
};

const ungroupedRule: RulerGrafanaRuleDTO = produce(grafanaRulerRule, (draft) => {
  draft.grafana_alert.uid = 'ungrouped-rule-uid';
  draft.grafana_alert.title = 'Ungrouped rule';
  draft.grafana_alert.rule_group = `${NO_GROUP_PREFIX}ungrouped-rule-uid`;
});

const ungroupedRuleGroup: RulerRuleGroupDTO<RulerGrafanaRuleDTO> = {
  name: ungroupedRule.grafana_alert.rule_group,
  interval: '1m',
  rules: [ungroupedRule],
};

const recordingRule: RulerGrafanaRuleDTO = produce(grafanaRulerRule, (draft) => {
  draft.grafana_alert.uid = 'recording-rule-uid';
  draft.grafana_alert.title = 'Recording rule';
  draft.grafana_alert.no_data_state = undefined as unknown as GrafanaAlertStateDecision;
  draft.grafana_alert.exec_err_state = undefined as unknown as GrafanaAlertStateDecision;
  // target_datasource_uid is required by the recording-rule form's react-hook-form validation.
  draft.grafana_alert.record = {
    metric: 'rec_metric',
    from: 'A',
    target_datasource_uid: PROMETHEUS_DATASOURCE_UID,
  };
});

const recordingRuleGroup: RulerRuleGroupDTO<RulerGrafanaRuleDTO> = {
  name: grafanaRulerGroup.name,
  interval: grafanaRulerGroup.interval,
  rules: [recordingRule],
};

describe('AlertRuleForm submit failure handling', () => {
  testWithFeatureToggles({ enable: ['alerting.rulesAPIV2'] });

  beforeEach(() => {
    grantAlertingPermissions();
    mockPreviewApiResponse(server, []);
  });

  it.each<{ mode: EvaluationMode; label: string }>([
    { mode: 'new', label: 'no group (new evaluation mode)' },
    { mode: 'legacy', label: 'with selected group (legacy evaluation mode)' },
  ])(
    'surfaces a form-level error notification when creating a rule fails and does not redirect — $label',
    async ({ mode }) => {
      if (mode === 'legacy') {
        setUpdateGrafanaRulerRuleNamespaceResolver(async () =>
          HttpResponse.json({ message: 'boom from the api' }, { status: 500 })
        );
      } else {
        setCreateGrafanaRuleResolver(async () => HttpResponse.json({ message: 'boom from the api' }, { status: 500 }));
      }
      const replaceSpy = jest.spyOn(locationService, 'replace');

      const { user } = renderRuleEditor();

      await fillRuleBasics(user);
      if (mode === 'legacy') {
        await selectLegacyGroup(user);
      }
      await user.click(ui.buttons.save.get());

      expect(await screen.findByText(/Failed to save alert rule/i)).toBeInTheDocument();
      expect(screen.queryByText(/Rule added successfully/i)).not.toBeInTheDocument();

      await waitFor(() => {
        expect(ui.buttons.save.get()).toBeEnabled();
      });
      expect(replaceSpy).not.toHaveBeenCalled();
    }
  );
});

// Pin which endpoint the form hits for every reachable combination of
// (existing-rule group state) × (target group state). These tests guard against
// silent regressions in the routing decision when we add or remove paths.
//
// Note on case "ungrouped → grouped": the evaluation-mode radio is hidden in
// GrafanaEvaluationBehavior when editing an ungrouped rule, so the user has no
// way to re-group from this form. We don't test that transition here.
describe('AlertRuleForm — submit routing by group presence', () => {
  testWithFeatureToggles({ enable: ['alerting.rulesAPIV2'] });

  const folder = mockFolder({
    title: 'Folder A',
    uid: grafanaRulerRule.grafana_alert.namespace_uid,
    accessControl: { [AccessControlAction.AlertingRuleUpdate]: true },
  });

  beforeEach(() => {
    grantAlertingPermissions();
    setFolderResponse(folder);
    mockPreviewApiResponse(server, []);
  });

  afterEach(() => {
    // captureRequests attaches MSW listeners that aren't cleaned up otherwise;
    // accumulating across tests trips MaxListenersExceeded and jest-fail-on-console.
    server.events.removeAllListeners('request:start');
  });

  describe('on create', () => {
    it('with selected group, POSTs to legacy ruler API only', async () => {
      const legacyRequests = captureRequests((req) => req.method === 'POST' && req.url.includes(LEGACY_RULER_BASE));
      const appPlatformRequests = captureRequests(
        (req) => req.method === 'POST' && req.url.includes(APP_PLATFORM_ALERTRULES_BASE)
      );

      const { user } = renderRuleEditor();
      await fillRuleBasics(user);
      await selectLegacyGroup(user);
      await user.click(ui.buttons.save.get());

      await waitFor(async () => {
        expect(await legacyRequests).toHaveLength(1);
      });
      expect(await appPlatformRequests).toHaveLength(0);
    });

    it('without group, POSTs to app-platform alertrules only', async () => {
      setCreateGrafanaRuleResolver(echoBodyResolver);
      const legacyRequests = captureRequests((req) => req.method === 'POST' && req.url.includes(LEGACY_RULER_BASE));
      const appPlatformRequests = captureRequests(
        (req) => req.method === 'POST' && req.url.includes(APP_PLATFORM_ALERTRULES_BASE)
      );

      const { user } = renderRuleEditor();
      await fillRuleBasics(user);
      await user.click(ui.buttons.save.get());

      expect(await screen.findByText(/Rule added successfully/i)).toBeInTheDocument();
      expect(await appPlatformRequests).toHaveLength(1);
      expect(await legacyRequests).toHaveLength(0);
    });
  });

  describe('on edit', () => {
    it('grouped → grouped, POSTs to legacy ruler API only', async () => {
      const legacyRequests = captureRequests(
        (req) =>
          req.method === 'POST' &&
          req.url.includes(`${LEGACY_RULER_BASE}${grafanaRulerRule.grafana_alert.namespace_uid}`)
      );
      const appPlatformRequests = captureRequests(
        (req) => req.method === 'PUT' && req.url.includes(APP_PLATFORM_ALERTRULES_BASE)
      );

      const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
      expect(await ui.inputs.name.find()).toHaveValue(grafanaRulerRule.grafana_alert.title);

      await user.click(ui.buttons.save.get());

      await waitFor(async () => {
        expect(await legacyRequests).toHaveLength(1);
      });
      expect(await appPlatformRequests).toHaveLength(0);
    });

    it('grouped → ungrouped (alerting), PUTs to app-platform alertrules with the rule body and redirects', async () => {
      setReplaceGrafanaRuleResolver(echoBodyResolver);
      const appPlatformRequests = captureRequests(
        (req) =>
          req.method === 'PUT' &&
          req.url.includes(`${APP_PLATFORM_ALERTRULES_BASE}/${grafanaRulerRule.grafana_alert.uid}`)
      );
      const legacyRequests = captureRequests((req) => req.method === 'POST' && req.url.includes(LEGACY_RULER_BASE));

      const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
      // Spy AFTER render — the test wrapper installs a fresh locationService singleton on mount.
      const replaceSpy = jest.spyOn(locationService, 'replace');

      expect(await ui.inputs.name.find()).toHaveValue(grafanaRulerRule.grafana_alert.title);
      await switchToNewMode(user);
      await user.click(ui.buttons.save.get());

      expect(await screen.findByText(/Rule updated successfully/i)).toBeInTheDocument();

      const requests = await appPlatformRequests;
      expect(requests).toHaveLength(1);
      const body = await requests[0].json();

      // Assert the body the form actually builds (not the absence of labels we never set).
      expect(body.metadata?.name).toBe(grafanaRulerRule.grafana_alert.uid);
      expect(body.metadata?.annotations?.['grafana.app/folder']).toBe(grafanaRulerRule.grafana_alert.namespace_uid);
      expect(body.kind).toBe('AlertRule');
      expect(body.spec?.title).toBe(grafanaRulerRule.grafana_alert.title);
      expect(body.spec?.trigger?.interval).toBe(grafanaRulerGroup.interval);

      expect(await legacyRequests).toHaveLength(0);
      expect(replaceSpy).toHaveBeenCalled();
    });

    it('grouped → ungrouped (recording), PUTs to app-platform recordingrules', async () => {
      overrideRulerRule(recordingRule);
      overrideRulerRuleGroup(recordingRule.grafana_alert.namespace_uid, recordingRuleGroup);
      setReplaceGrafanaRuleResolver(echoBodyResolver, 'recordingrules');

      const recordingRequests = captureRequests(
        (req) =>
          req.method === 'PUT' &&
          req.url.includes(`${APP_PLATFORM_RECORDINGRULES_BASE}/${recordingRule.grafana_alert.uid}`)
      );
      const alertRequests = captureRequests(
        (req) => req.method === 'PUT' && req.url.includes(APP_PLATFORM_ALERTRULES_BASE)
      );
      const legacyRequests = captureRequests((req) => req.method === 'POST' && req.url.includes(LEGACY_RULER_BASE));

      const { user } = renderRuleEditor(recordingRule.grafana_alert.uid, 'grafana-recording');
      expect(await ui.inputs.name.find()).toHaveValue(recordingRule.grafana_alert.title);
      await switchToNewMode(user);
      await user.click(ui.buttons.save.get());

      expect(await screen.findByText(/Rule updated successfully/i)).toBeInTheDocument();
      expect(await recordingRequests).toHaveLength(1);
      expect(await alertRequests).toHaveLength(0);
      expect(await legacyRequests).toHaveLength(0);
    });

    it('ungrouped → ungrouped, PUTs to app-platform alertrules only', async () => {
      overrideRulerRule(ungroupedRule);
      overrideRulerRuleGroup(ungroupedRule.grafana_alert.namespace_uid, ungroupedRuleGroup);
      setReplaceGrafanaRuleResolver(echoBodyResolver);

      const appPlatformRequests = captureRequests(
        (req) =>
          req.method === 'PUT' && req.url.includes(`${APP_PLATFORM_ALERTRULES_BASE}/${ungroupedRule.grafana_alert.uid}`)
      );
      const legacyRequests = captureRequests((req) => req.method === 'POST' && req.url.includes(LEGACY_RULER_BASE));

      const { user } = renderRuleEditor(ungroupedRule.grafana_alert.uid);
      expect(await ui.inputs.name.find()).toHaveValue(ungroupedRule.grafana_alert.title);

      await user.click(ui.buttons.save.get());

      expect(await screen.findByText(/Rule updated successfully/i)).toBeInTheDocument();
      expect(await appPlatformRequests).toHaveLength(1);
      expect(await legacyRequests).toHaveLength(0);
    });

    it('surfaces an error and does not redirect when the PUT fails', async () => {
      setReplaceGrafanaRuleResolver(async () => HttpResponse.json({ message: 'boom from the api' }, { status: 500 }));
      const replaceSpy = jest.spyOn(locationService, 'replace');

      const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
      expect(await ui.inputs.name.find()).toHaveValue(grafanaRulerRule.grafana_alert.title);

      await switchToNewMode(user);
      await user.click(ui.buttons.save.get());

      expect(await screen.findByText(/Failed to save alert rule/i)).toBeInTheDocument();
      expect(screen.queryByText(/Rule updated successfully/i)).not.toBeInTheDocument();

      await waitFor(() => {
        expect(ui.buttons.save.get()).toBeEnabled();
      });
      expect(replaceSpy).not.toHaveBeenCalled();
    });
  });
});

// Verifies the alerting.rulesAPIV2 gate: with the flag off the form must match
// `main` — no evaluation-mode radio, group is required, legacy ruler endpoint only.
describe('AlertRuleForm — alerting.rulesAPIV2 gate (flag off)', () => {
  beforeEach(() => {
    grantAlertingPermissions();
    setFolderResponse(
      mockFolder({
        title: 'Folder A',
        uid: grafanaRulerRule.grafana_alert.namespace_uid,
        accessControl: { [AccessControlAction.AlertingRuleUpdate]: true },
      })
    );
    mockPreviewApiResponse(server, []);
  });

  afterEach(() => {
    server.events.removeAllListeners('request:start');
  });

  it('does not render the evaluation-mode radio toggle', async () => {
    renderRuleEditor();

    expect(await ui.inputs.name.find()).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /set interval/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /use groups \(legacy\)/i })).not.toBeInTheDocument();
  });

  it('requires a group and POSTs to the legacy ruler API only', async () => {
    const legacyRequests = captureRequests((req) => req.method === 'POST' && req.url.includes(LEGACY_RULER_BASE));
    const appPlatformRequests = captureRequests(
      (req) => req.method === 'POST' && req.url.includes(APP_PLATFORM_ALERTRULES_BASE)
    );

    const { user } = renderRuleEditor();

    await fillRuleBasics(user);
    // Save without picking a group surfaces the required-group validation message.
    await user.click(ui.buttons.save.get());
    expect(await screen.findByText(/Must enter a group name/i)).toBeInTheDocument();

    // With the flag off the radio is not rendered, so go straight to the group select.
    const groupInput = await ui.inputs.group.find();
    await user.click(await byRole('combobox').find(groupInput));
    await clickSelectOption(groupInput, grafanaRulerGroup.name);

    await user.click(ui.buttons.save.get());

    await waitFor(async () => {
      expect(await legacyRequests).toHaveLength(1);
    });
    expect(await appPlatformRequests).toHaveLength(0);
  });

  it('surfaces a form-level error notification when the legacy ruler call fails and does not redirect', async () => {
    setUpdateGrafanaRulerRuleNamespaceResolver(async () =>
      HttpResponse.json({ message: 'boom from the api' }, { status: 500 })
    );
    const replaceSpy = jest.spyOn(locationService, 'replace');

    const { user } = renderRuleEditor();

    await fillRuleBasics(user);
    const groupInput = await ui.inputs.group.find();
    await user.click(await byRole('combobox').find(groupInput));
    await clickSelectOption(groupInput, grafanaRulerGroup.name);

    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Failed to save alert rule/i)).toBeInTheDocument();
    expect(screen.queryByText(/Rule added successfully/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(ui.buttons.save.get()).toBeEnabled();
    });
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
