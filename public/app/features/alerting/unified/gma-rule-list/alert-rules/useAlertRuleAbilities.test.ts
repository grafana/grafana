import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { isLoading } from '../../hooks/abilities/abilityUtils';
import {
  Granted,
  InsufficientPermissions,
  IsPluginManaged,
  Loading,
  NotSupported,
  Provisioned,
} from '../../hooks/abilities/types';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { setAlertmanagerChoices, setFolderResponse } from '../../mocks/server/configure';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { mockK8sAlertRule } from '../mocks/handlers';

import { useAlertRuleAbilities } from './useAlertRuleAbilities';

setupMswServer();

const RULE_FOLDER_UID = 'rule-folder';
const canRead = { [AccessControlAction.AlertingRuleRead]: true, [AccessControlAction.FoldersRead]: true };
const canWriteAndDelete = {
  ...canRead,
  [AccessControlAction.AlertingRuleUpdate]: true,
  [AccessControlAction.AlertingRuleDelete]: true,
};
const canSilence = { [AccessControlAction.AlertingSilenceCreate]: true };

function rule({
  annotations = {},
  labels,
}: { annotations?: Record<string, string>; labels?: Record<string, string> } = {}): AlertRule {
  const base = mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' });
  return {
    ...base,
    metadata: { ...base.metadata, annotations: { [AnnoKeyFolder]: RULE_FOLDER_UID, ...annotations } },
    spec: { ...base.spec, labels },
  };
}

function hookAbilities(alertRule: AlertRule) {
  return renderHook(() => useAlertRuleAbilities(alertRule), { wrapper: getWrapper({}) }).result;
}

async function getAbilities(alertRule: AlertRule) {
  const result = hookAbilities(alertRule);
  await waitFor(() => expect(isLoading(result.current.silence)).toBe(false));
  return result.current;
}

async function getAbilitiesInFolder(alertRule: AlertRule, accessControl: Record<string, boolean>) {
  setFolderResponse({ uid: RULE_FOLDER_UID, accessControl });
  return getAbilities(alertRule);
}

describe('useAlertRuleAbilities', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
  });

  it('switches to the permissions of the new folder when the rule moves', async () => {
    setFolderResponse({ uid: RULE_FOLDER_UID, accessControl: { ...canWriteAndDelete, ...canSilence } });
    setFolderResponse({ uid: 'read-only-folder', accessControl: canRead });
    const { result, rerender } = renderHook((alertRule: AlertRule) => useAlertRuleAbilities(alertRule), {
      initialProps: rule(),
      wrapper: getWrapper({}),
    });

    await waitFor(() => expect(result.current.edit).toEqual(Granted));
    expect(result.current.pause).toEqual(Granted);
    expect(result.current.delete).toEqual(Granted);
    expect(result.current.duplicate).toEqual(Granted);
    expect(result.current.silence).toEqual(Granted);

    rerender(rule({ annotations: { [AnnoKeyFolder]: 'read-only-folder' } }));

    expect(result.current.edit).toEqual(Loading);
    await waitFor(() =>
      expect(result.current.edit).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]))
    );
    expect(result.current.pause).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    expect(result.current.delete).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleDelete]));
    expect(result.current.duplicate).toEqual(Granted);
    expect(result.current.silence).toEqual(
      InsufficientPermissions([AccessControlAction.AlertingSilenceCreate, AccessControlAction.AlertingInstanceCreate])
    );
  });

  it('reports edit, pause, delete and silence as loading until the folder access has loaded', async () => {
    setFolderResponse({ uid: RULE_FOLDER_UID, accessControl: canWriteAndDelete });
    const result = hookAbilities(rule());

    expect(result.current.edit).toEqual(Loading);
    expect(result.current.pause).toEqual(Loading);
    expect(result.current.delete).toEqual(Loading);
    expect(result.current.silence).toEqual(Loading);
    await waitFor(() => expect(result.current.edit).toEqual(Granted));
  });

  it('denies edit and delete when the rule folder cannot be loaded', async () => {
    const result = hookAbilities(rule({ annotations: { [AnnoKeyFolder]: 'missing-folder' } }));

    await waitFor(() => expect(isLoading(result.current.edit)).toBe(false));
    expect(result.current.edit).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    expect(result.current.delete).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleDelete]));
  });

  it.each([
    {
      reason: 'provisioned',
      rule: rule({ annotations: { [K8sAnnotations.Provenance]: 'terraform' } }),
      lock: Provisioned,
      duplicate: Granted,
    },
    {
      reason: 'managed by an external system',
      rule: rule({ annotations: { 'grafana.app/managedBy': 'terraform' } }),
      lock: Provisioned,
      duplicate: Granted,
    },
    {
      reason: 'plugin-managed',
      rule: rule({ labels: { __grafana_origin: 'plugin/my-plugin' } }),
      lock: IsPluginManaged,
      duplicate: IsPluginManaged,
    },
  ])('locks edit, pause and delete but not silence for $reason rules', async ({ rule, lock, duplicate }) => {
    const abilities = await getAbilitiesInFolder(rule, { ...canWriteAndDelete, ...canSilence });

    expect(abilities.edit).toEqual(lock);
    expect(abilities.pause).toEqual(lock);
    expect(abilities.delete).toEqual(lock);
    expect(abilities.duplicate).toEqual(duplicate);
    expect(abilities.silence).toEqual(Granted);
  });

  it('denies edit and pause without write access to the rule folder', async () => {
    const abilities = await getAbilitiesInFolder(rule(), {
      ...canWriteAndDelete,
      [AccessControlAction.AlertingRuleUpdate]: false,
    });

    expect(abilities.edit).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    expect(abilities.pause).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    expect(abilities.delete).toEqual(Granted);
  });

  it('denies delete without delete access to the rule folder', async () => {
    const abilities = await getAbilitiesInFolder(rule(), {
      ...canWriteAndDelete,
      [AccessControlAction.AlertingRuleDelete]: false,
    });

    expect(abilities.edit).toEqual(Granted);
    expect(abilities.delete).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleDelete]));
  });

  it('denies edit and delete without read access to the rule folder', async () => {
    const abilities = await getAbilitiesInFolder(rule(), {
      ...canWriteAndDelete,
      [AccessControlAction.FoldersRead]: false,
    });

    expect(abilities.edit).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    expect(abilities.delete).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleDelete]));
  });

  it('denies duplicate without the create permission', async () => {
    grantUserPermissions([]);
    const abilities = await getAbilities(rule());

    expect(abilities.duplicate).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleCreate]));
  });

  it.each([
    {
      source: 'the global instance create permission',
      global: [AccessControlAction.AlertingInstanceCreate],
      folder: {},
    },
    { source: 'the silence permission on the rule folder', global: [], folder: canSilence },
  ])('grants silence from $source', async ({ global, folder }) => {
    grantUserPermissions(global);
    const abilities = await getAbilitiesInFolder(rule(), folder);

    expect(abilities.silence).toEqual(Granted);
  });

  it('does not support silence when Grafana only sends alerts to external alertmanagers', async () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceCreate]);
    setAlertmanagerChoices(AlertmanagerChoice.External, 1);
    const abilities = await getAbilities(rule());

    expect(abilities.silence).toEqual(NotSupported);
  });
});
