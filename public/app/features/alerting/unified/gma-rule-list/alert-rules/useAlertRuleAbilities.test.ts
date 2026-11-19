import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { isLoading } from '../../hooks/abilities/abilityUtils';
import { Granted, InsufficientPermissions, IsPluginManaged, Loading, Provisioned } from '../../hooks/abilities/types';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { setFolderResponse } from '../../mocks/server/configure';
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

  it('grants edit, pause, delete and duplicate from the rule permissions on the rule folder', async () => {
    const abilities = await getAbilitiesInFolder(rule(), canWriteAndDelete);

    expect(abilities.edit).toEqual(Granted);
    expect(abilities.pause).toEqual(Granted);
    expect(abilities.delete).toEqual(Granted);
    expect(abilities.duplicate).toEqual(Granted);
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

  it('locks edit, pause and delete for provisioned rules but still allows duplicate and silence', async () => {
    const abilities = await getAbilitiesInFolder(rule({ annotations: { [K8sAnnotations.Provenance]: 'terraform' } }), {
      ...canWriteAndDelete,
      ...canSilence,
    });

    expect(abilities.edit).toEqual(Provisioned);
    expect(abilities.pause).toEqual(Provisioned);
    expect(abilities.delete).toEqual(Provisioned);
    expect(abilities.duplicate).toEqual(Granted);
    expect(abilities.silence).toEqual(Granted);
  });

  it('locks everything but silence, duplicate included, for plugin-managed rules', async () => {
    const abilities = await getAbilitiesInFolder(rule({ labels: { __grafana_origin: 'plugin/my-plugin' } }), {
      ...canWriteAndDelete,
      ...canSilence,
    });

    expect(abilities.edit).toEqual(IsPluginManaged);
    expect(abilities.pause).toEqual(IsPluginManaged);
    expect(abilities.delete).toEqual(IsPluginManaged);
    expect(abilities.duplicate).toEqual(IsPluginManaged);
    expect(abilities.silence).toEqual(Granted);
  });

  it('treats rules managed by an external system as provisioned', async () => {
    const abilities = await getAbilitiesInFolder(rule({ annotations: { 'grafana.app/managedBy': 'terraform' } }), {
      ...canWriteAndDelete,
      ...canSilence,
    });

    expect(abilities.edit).toEqual(Provisioned);
    expect(abilities.delete).toEqual(Provisioned);
    expect(abilities.duplicate).toEqual(Granted);
    expect(abilities.silence).toEqual(Granted);
  });

  it('denies edit and pause without the write permission on the rule folder', async () => {
    const abilities = await getAbilitiesInFolder(rule(), {
      ...canRead,
      ...canSilence,
      [AccessControlAction.AlertingRuleDelete]: true,
    });

    expect(abilities.edit).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    expect(abilities.pause).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    expect(abilities.delete).toEqual(Granted);
    expect(abilities.silence).toEqual(Granted);
  });

  it('denies delete without the delete permission on the rule folder', async () => {
    const abilities = await getAbilitiesInFolder(rule(), {
      ...canRead,
      ...canSilence,
      [AccessControlAction.AlertingRuleUpdate]: true,
    });

    expect(abilities.edit).toEqual(Granted);
    expect(abilities.delete).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleDelete]));
    expect(abilities.silence).toEqual(Granted);
  });

  it('denies edit and delete without read access to the rule folder', async () => {
    const abilities = await getAbilitiesInFolder(rule(), {
      ...canSilence,
      [AccessControlAction.AlertingRuleRead]: true,
      [AccessControlAction.AlertingRuleUpdate]: true,
      [AccessControlAction.AlertingRuleDelete]: true,
    });

    expect(abilities.edit).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    expect(abilities.delete).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleDelete]));
    expect(abilities.silence).toEqual(Granted);
  });

  it('denies duplicate without the create permission', async () => {
    grantUserPermissions([]);
    const abilities = await getAbilities(rule());

    expect(abilities.duplicate).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleCreate]));
  });

  it('grants silence with the global instance create permission', async () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceCreate]);
    const result = hookAbilities(rule());

    await waitFor(() => expect(result.current.silence).toEqual(Granted));
  });

  it('grants silence from the silence permission on the rule folder', async () => {
    grantUserPermissions([]);
    setFolderResponse({
      uid: RULE_FOLDER_UID,
      accessControl: canSilence,
    });
    const result = hookAbilities(rule());

    await waitFor(() => expect(result.current.silence).toEqual(Granted));
  });

  it('denies silence without any silence permission', async () => {
    grantUserPermissions([]);
    const abilities = await getAbilities(rule());

    expect(abilities.silence).toEqual(
      InsufficientPermissions([AccessControlAction.AlertingSilenceCreate, AccessControlAction.AlertingInstanceCreate])
    );
  });
});
