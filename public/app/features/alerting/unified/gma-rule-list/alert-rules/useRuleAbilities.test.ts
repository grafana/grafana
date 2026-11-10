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
  NotSupported,
  Provisioned,
} from '../../hooks/abilities/types';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { setAlertmanagerChoices, setFolderResponse } from '../../mocks/server/configure';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { mockK8sAlertRule } from '../mocks/handlers';

import { useRuleAbilities } from './useRuleAbilities';

setupMswServer();

const canWriteAndDelete = { [K8sAnnotations.AccessWrite]: 'true', [K8sAnnotations.AccessDelete]: 'true' };

function rule({
  annotations = canWriteAndDelete,
  labels,
}: { annotations?: Record<string, string>; labels?: Record<string, string> } = {}): AlertRule {
  const base = mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' });
  return { ...base, metadata: { ...base.metadata, annotations }, spec: { ...base.spec, labels } };
}

function hookAbilities(alertRule: AlertRule) {
  return renderHook(() => useRuleAbilities(alertRule), { wrapper: getWrapper({}) }).result;
}

async function getAbilities(alertRule: AlertRule) {
  const result = hookAbilities(alertRule);
  await waitFor(() => expect(isLoading(result.current.silence)).toBe(false));
  return result.current;
}

describe('useRuleAbilities', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
  });

  it('grants edit, pause, delete and duplicate when the access annotations allow it', async () => {
    const abilities = await getAbilities(rule());

    expect(abilities.edit).toEqual(Granted);
    expect(abilities.pause).toEqual(Granted);
    expect(abilities.delete).toEqual(Granted);
    expect(abilities.duplicate).toEqual(Granted);
  });

  it('locks edit, pause and delete for provisioned rules but still allows duplicate', async () => {
    const abilities = await getAbilities(
      rule({ annotations: { ...canWriteAndDelete, [K8sAnnotations.Provenance]: 'terraform' } })
    );

    expect(abilities.edit).toEqual(Provisioned);
    expect(abilities.pause).toEqual(Provisioned);
    expect(abilities.delete).toEqual(Provisioned);
    expect(abilities.duplicate).toEqual(Granted);
  });

  it('locks everything, duplicate included, for plugin-managed rules', async () => {
    const abilities = await getAbilities(rule({ labels: { __grafana_origin: 'plugin/my-plugin' } }));

    expect(abilities.edit).toEqual(IsPluginManaged);
    expect(abilities.pause).toEqual(IsPluginManaged);
    expect(abilities.delete).toEqual(IsPluginManaged);
    expect(abilities.duplicate).toEqual(IsPluginManaged);
  });

  it('treats rules managed by an external system as provisioned', async () => {
    const abilities = await getAbilities(
      rule({ annotations: { ...canWriteAndDelete, 'grafana.app/managedBy': 'terraform' } })
    );

    expect(abilities.edit).toEqual(Provisioned);
    expect(abilities.delete).toEqual(Provisioned);
    expect(abilities.duplicate).toEqual(Granted);
  });

  it('denies edit and pause without the write annotation', async () => {
    const abilities = await getAbilities(rule({ annotations: { [K8sAnnotations.AccessDelete]: 'true' } }));

    expect(abilities.edit).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    expect(abilities.pause).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    expect(abilities.delete).toEqual(Granted);
  });

  it('denies delete without the delete annotation', async () => {
    const abilities = await getAbilities(rule({ annotations: { [K8sAnnotations.AccessWrite]: 'true' } }));

    expect(abilities.delete).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleDelete]));
  });

  it('denies duplicate without the create permission', async () => {
    grantUserPermissions([]);
    const abilities = await getAbilities(rule());

    expect(abilities.duplicate).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleCreate]));
  });

  describe('silence', () => {
    it('grants silence with the global instance create permission', async () => {
      grantUserPermissions([AccessControlAction.AlertingInstanceCreate]);
      const result = hookAbilities(rule());

      await waitFor(() => expect(result.current.silence).toEqual(Granted));
    });

    it('grants silence from the silence permission on the rule folder', async () => {
      grantUserPermissions([]);
      setFolderResponse({
        uid: 'folder-a',
        title: 'Folder A',
        accessControl: { [AccessControlAction.AlertingSilenceCreate]: true },
      });
      const result = hookAbilities(rule({ annotations: { ...canWriteAndDelete, [AnnoKeyFolder]: 'folder-a' } }));

      await waitFor(() => expect(result.current.silence).toEqual(Granted));
    });

    it('denies silence without any silence permission', async () => {
      grantUserPermissions([]);
      const abilities = await getAbilities(rule());

      expect(abilities.silence).toEqual(
        InsufficientPermissions([AccessControlAction.AlertingSilenceCreate, AccessControlAction.AlertingInstanceCreate])
      );
    });

    it('is not supported when Grafana only sends alerts to external alertmanagers', async () => {
      grantUserPermissions([AccessControlAction.AlertingInstanceCreate]);
      setAlertmanagerChoices(AlertmanagerChoice.External, 1);
      const abilities = await getAbilities(rule());

      expect(abilities.silence).toEqual(NotSupported);
    });
  });
});
