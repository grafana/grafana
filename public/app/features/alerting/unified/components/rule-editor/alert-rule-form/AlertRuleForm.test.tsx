import { HttpResponse, http } from 'msw';
import * as React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { cleanup, screen, waitFor, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { locationService, setPluginLinksHook } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { testWithFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { PROMETHEUS_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { grantUserPermissions, mockDataSource, mockFolder } from '../../../mocks';
import {
  grafanaRulerGroup,
  grafanaRulerRecordingGroup,
  grafanaRulerRecordingRule,
  grafanaRulerRule,
  mockPreviewApiResponse,
  ungroupedGrafanaRulerGroup,
  ungroupedGrafanaRulerRule,
} from '../../../mocks/grafanaRulerApi';
import {
  echoBodyResolver,
  setCreateGrafanaRuleResolver,
  setFolderResponse,
  setGrafanaRulerRuleResolver,
  setReplaceGrafanaRuleResolver,
  setRulesAPIGroupVersions,
  setUpdateGrafanaRulerRuleNamespaceResolver,
} from '../../../mocks/server/configure';
import {
  MOCK_K8S_RULE_RESOURCE_VERSION,
  getAlertRuleHandler,
  mockK8sRuleFromRuler,
} from '../../../mocks/server/handlers/k8s/alertRules.k8s';
import { getRecordingRuleHandler } from '../../../mocks/server/handlers/k8s/recordingrules.k8s';
import { setupDataSources } from '../../../testSetup/datasources';

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

const fillRuleBasics = async (user: ReturnType<typeof renderRuleEditor>['user']) => {
  await user.type(await ui.inputs.name.find(), 'my new rule');
  await user.click(await screen.findByRole('button', { name: /select folder/i }));
  await user.click(await screen.findByLabelText('Folder A'));
  await user.type(ui.inputs.annotationValue(1).get(), 'some description');
};

const selectGroup = async (user: ReturnType<typeof renderRuleEditor>['user']) => {
  const groupInput = await ui.inputs.group.find();
  await user.click(await byRole('combobox').find(groupInput));
  await clickSelectOption(groupInput, grafanaRulerGroup.name);
};

const failWith = (message: string) => async () => HttpResponse.json({ message }, { status: 500 });

const getAlertRuleHandlerFailingWith = (message: string) =>
  http.get('/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/:name', failWith(message));

// Like the apiserver: a replace that doesn't carry the stored resourceVersion is a conflict.
const echoIfVersion = (storedVersion: string) => async (info: Parameters<typeof echoBodyResolver>[0]) => {
  const body = (await info.request.clone().json()) as AlertRule;
  if (body.metadata.resourceVersion !== storedVersion) {
    return HttpResponse.json({ message: 'the object has been modified' }, { status: 409 });
  }
  return echoBodyResolver(info);
};

const folderA = mockFolder({
  title: 'Folder A',
  uid: grafanaRulerRule.grafana_alert.namespace_uid,
  accessControl: {
    [AccessControlAction.AlertingRuleRead]: true,
    [AccessControlAction.AlertingRuleUpdate]: true,
    [AccessControlAction.FoldersRead]: true,
  },
});

describe('AlertRuleForm — alerting.gmaOnlyListView on (k8s rules API)', () => {
  // Unmount before the flags reset, or flag-reading components re-render outside act().
  afterEach(cleanup);
  testWithFlags({ [FlagKeys.AlertingGmaOnlyListView]: true });

  beforeEach(() => {
    grantAlertingPermissions();
    setFolderResponse(folderA);
    mockPreviewApiResponse(server, []);
    setUpdateGrafanaRulerRuleNamespaceResolver(failWith('ruler API was used'));
    setGrafanaRulerRuleResolver(failWith('ruler API was used'));
    server.use(
      getAlertRuleHandler([
        mockK8sRuleFromRuler(grafanaRulerRule, grafanaRulerGroup) as AlertRule,
        mockK8sRuleFromRuler(ungroupedGrafanaRulerRule, ungroupedGrafanaRulerGroup) as AlertRule,
      ]),
      getRecordingRuleHandler([
        mockK8sRuleFromRuler(grafanaRulerRecordingRule, grafanaRulerRecordingGroup) as RecordingRule,
      ])
    );
  });

  it('shows only the evaluation interval, with no group picker or mode switch', async () => {
    renderRuleEditor();

    expect(await ui.inputs.name.find()).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /evaluation interval/i })).toBeInTheDocument();
    expect(ui.inputs.group.query()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new evaluation group/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /set interval/i })).not.toBeInTheDocument();
  });

  it('creates a rule through the k8s rules API', async () => {
    setCreateGrafanaRuleResolver(echoBodyResolver);

    const { user } = renderRuleEditor();
    await fillRuleBasics(user);
    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Rule added successfully/i)).toBeInTheDocument();
    expect(screen.queryByText(/ruler API was used/i)).not.toBeInTheDocument();
  });

  it('surfaces an error and does not redirect when the create fails', async () => {
    setCreateGrafanaRuleResolver(failWith('boom from the api'));
    const replaceSpy = jest.spyOn(locationService, 'replace');

    const { user } = renderRuleEditor();
    await fillRuleBasics(user);
    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Failed to save alert rule/i)).toBeInTheDocument();
    expect(screen.queryByText(/Rule added successfully/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(ui.buttons.save.get()).toBeEnabled();
    });
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('saves an existing grouped alert rule through the k8s rules API and redirects', async () => {
    setReplaceGrafanaRuleResolver(echoIfVersion(MOCK_K8S_RULE_RESOURCE_VERSION));

    const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
    const replaceSpy = jest.spyOn(locationService, 'replace');
    expect(await ui.inputs.name.find()).toHaveValue(grafanaRulerRule.grafana_alert.title);
    expect(screen.getByRole('textbox', { name: /evaluation interval/i })).toHaveValue(grafanaRulerGroup.interval);
    expect(screen.getByText(/Evaluation groups are retired/i)).toBeInTheDocument();

    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Rule updated successfully/i)).toBeInTheDocument();
    expect(replaceSpy).toHaveBeenCalled();
  });

  it('saves an existing grouped recording rule through the k8s recording rules API', async () => {
    setReplaceGrafanaRuleResolver(failWith('alert rules API was used'));
    setReplaceGrafanaRuleResolver(echoIfVersion(MOCK_K8S_RULE_RESOURCE_VERSION), 'recordingrules');

    const { user } = renderRuleEditor(grafanaRulerRecordingRule.grafana_alert.uid, 'grafana-recording');
    expect(await ui.inputs.name.find()).toHaveValue(grafanaRulerRecordingRule.grafana_alert.title);
    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Rule updated successfully/i)).toBeInTheDocument();
  });

  it('saves an existing ungrouped rule through the k8s rules API', async () => {
    setReplaceGrafanaRuleResolver(echoIfVersion(MOCK_K8S_RULE_RESOURCE_VERSION));

    const { user } = renderRuleEditor(ungroupedGrafanaRulerRule.grafana_alert.uid);
    expect(await ui.inputs.name.find()).toHaveValue(ungroupedGrafanaRulerRule.grafana_alert.title);
    expect(screen.queryByText(/Evaluation groups are retired/i)).not.toBeInTheDocument();
    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Rule updated successfully/i)).toBeInTheDocument();
  });

  it('loads only the kind of rule the edit link names', async () => {
    server.use(getAlertRuleHandlerFailingWith('alert rules API was used'));

    renderRuleEditor(`${grafanaRulerRecordingRule.grafana_alert.uid}?kind=recording`);

    expect(await ui.inputs.name.find()).toHaveValue(grafanaRulerRecordingRule.grafana_alert.title);
  });

  it('shows that the rule does not exist when neither rules API kind has it', async () => {
    renderRuleEditor('missing-rule-uid');

    expect(await screen.findByText(/rule not found/i)).toBeInTheDocument();
  });

  it('refuses to overwrite a rule that changed after it was loaded', async () => {
    setReplaceGrafanaRuleResolver(echoIfVersion('8'));

    const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
    expect(await ui.inputs.name.find()).toHaveValue(grafanaRulerRule.grafana_alert.title);
    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Failed to save alert rule/i)).toBeInTheDocument();
    expect(screen.queryByText(/Rule updated successfully/i)).not.toBeInTheDocument();
  });

  it('surfaces an error and does not redirect when the update fails', async () => {
    setReplaceGrafanaRuleResolver(failWith('boom from the api'));
    const replaceSpy = jest.spyOn(locationService, 'replace');

    const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
    expect(await ui.inputs.name.find()).toHaveValue(grafanaRulerRule.grafana_alert.title);
    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Failed to save alert rule/i)).toBeInTheDocument();
    expect(screen.queryByText(/Rule updated successfully/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(ui.buttons.save.get()).toBeEnabled();
    });
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  // The frontend can be deployed ahead of a backend that doesn't serve rules v1beta1 yet.
  describe('when the server only serves rules v0alpha1', () => {
    beforeEach(() => {
      setRulesAPIGroupVersions(['v0alpha1']);
      setCreateGrafanaRuleResolver(failWith('v1beta1 was used'));
      setReplaceGrafanaRuleResolver(failWith('v1beta1 was used'));
    });

    it('creates a rule through the v0alpha1 alert rules API', async () => {
      setCreateGrafanaRuleResolver(echoBodyResolver, 'alertrules', 'v0alpha1');

      const { user } = renderRuleEditor();
      await fillRuleBasics(user);
      await user.click(ui.buttons.save.get());

      expect(await screen.findByText(/Rule added successfully/i)).toBeInTheDocument();
    });

    it('updates an ungrouped rule through the v0alpha1 alert rules API', async () => {
      setReplaceGrafanaRuleResolver(echoIfVersion(MOCK_K8S_RULE_RESOURCE_VERSION), 'alertrules', 'v0alpha1');

      const { user } = renderRuleEditor(ungroupedGrafanaRulerRule.grafana_alert.uid);
      expect(await ui.inputs.name.find()).toHaveValue(ungroupedGrafanaRulerRule.grafana_alert.title);
      await user.click(ui.buttons.save.get());

      expect(await screen.findByText(/Rule updated successfully/i)).toBeInTheDocument();
    });
  });
});

describe('AlertRuleForm — alerting.gmaOnlyListView off (ruler API)', () => {
  beforeEach(() => {
    grantAlertingPermissions();
    setFolderResponse(folderA);
    mockPreviewApiResponse(server, []);
    setCreateGrafanaRuleResolver(failWith('k8s rules API was used'));
    setReplaceGrafanaRuleResolver(failWith('k8s rules API was used'));
    setUpdateGrafanaRulerRuleNamespaceResolver(({ params }) =>
      params.folderUid === folderA.uid
        ? HttpResponse.json({ message: 'updated', updated: [] })
        : HttpResponse.json({ message: `saved to folder ${params.folderUid}` }, { status: 500 })
    );
  });

  it('shows the evaluation group picker without a mode switch', async () => {
    renderRuleEditor();

    expect(await ui.inputs.group.find()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new evaluation group/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /set interval/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /use groups \(legacy\)/i })).not.toBeInTheDocument();
  });

  it('focuses the name when saving an empty form', async () => {
    const { user } = renderRuleEditor();
    const name = await ui.inputs.name.find();

    await user.click(ui.buttons.save.get());

    await waitFor(() => expect(name).toHaveFocus());
  });

  it('focuses the folder before the missing evaluation group', async () => {
    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my new rule');
    await user.click(ui.buttons.save.get());

    expect(await screen.findByText('Folder is required')).toBeInTheDocument();
    expect(screen.getByText('Evaluation group is required')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /select folder/i })).toHaveFocus());
  });

  it('focuses the missing evaluation group when a folder is selected', async () => {
    const { user } = renderRuleEditor();
    await fillRuleBasics(user);
    const group = within(await ui.inputs.group.find()).getByRole('combobox');
    await waitFor(() => expect(group).toBeEnabled());

    await user.click(ui.buttons.save.get());

    expect(await screen.findByText('Evaluation group is required')).toBeInTheDocument();
    await waitFor(() => expect(group).toHaveFocus());
  });

  it('shows the folder validation message when saving without a folder', async () => {
    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my new rule');
    await user.click(ui.buttons.save.get());

    expect(await screen.findByText('Folder is required')).toBeInTheDocument();
  });

  it('clears the folder validation message once a folder is selected', async () => {
    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my new rule');
    await user.click(ui.buttons.save.get());
    expect(await screen.findByText('Folder is required')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /select folder/i }));
    await user.click(await screen.findByLabelText('Folder A'));

    await waitFor(() => expect(screen.queryByText('Folder is required')).not.toBeInTheDocument());
  });

  it('shows the selected folder in the folder picker', async () => {
    const { user } = renderRuleEditor();

    await user.click(await screen.findByRole('button', { name: /select folder/i }));
    await user.click(await screen.findByLabelText('Folder A'));

    await waitFor(() => expect(ui.inputs.folder.get()).toHaveTextContent('Folder A'));
  });

  it('requires a group and saves through the ruler API', async () => {
    const { user } = renderRuleEditor();

    await fillRuleBasics(user);
    await user.click(ui.buttons.save.get());
    expect(await screen.findByText(/Evaluation group is required/i)).toBeInTheDocument();

    await selectGroup(user);
    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Rule added successfully/i)).toBeInTheDocument();
    expect(screen.queryByText(/k8s rules API was used/i)).not.toBeInTheDocument();
  });

  it('saves an existing grouped rule through the ruler API', async () => {
    const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
    expect(await ui.inputs.name.find()).toHaveValue(grafanaRulerRule.grafana_alert.title);

    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Rule updated successfully/i)).toBeInTheDocument();
  });

  it('surfaces a form-level error notification when the legacy ruler call fails and does not redirect', async () => {
    setUpdateGrafanaRulerRuleNamespaceResolver(async () =>
      HttpResponse.json({ message: 'boom from the api' }, { status: 500 })
    );
    const replaceSpy = jest.spyOn(locationService, 'replace');

    const { user } = renderRuleEditor();

    await fillRuleBasics(user);
    await selectGroup(user);

    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Failed to save alert rule/i)).toBeInTheDocument();
    expect(screen.queryByText(/Rule added successfully/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(ui.buttons.save.get()).toBeEnabled();
    });
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});

describe('AlertRuleForm labels', () => {
  beforeEach(() => {
    grantAlertingPermissions();
    mockPreviewApiResponse(server, []);
  });

  it('shows the labels saved in the labels editor', async () => {
    const { user } = renderRuleEditor();

    await user.click(await screen.findByRole('button', { name: 'Add labels' }));
    const dialog = await screen.findByRole('dialog');
    const keyPicker = within(dialog).getByTestId('labelsInSubform-key-0');
    await user.type(within(keyPicker).getByRole('combobox'), 'team{enter}');
    const valuePicker = within(dialog).getByTestId('labelsInSubform-value-0');
    await user.type(within(valuePicker).getByRole('combobox'), 'alerting{enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByLabelText('team: alerting')).toBeInTheDocument();
  });
});
