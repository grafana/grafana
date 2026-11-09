import { renderHook } from '@testing-library/react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AccessControlAction } from 'app/types/accessControl';

import { useCanSilenceInFolder, useGrafanaRulesSilenceSupport } from '../../hooks/abilities/rules/ruleAbilities.utils';
import { Granted, InsufficientPermissions, IsPluginManaged, Loading, Provisioned } from '../../hooks/abilities/types';
import { useAlertingAbility } from '../../hooks/useAbilities';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { mockK8sAlertRule } from '../mocks/handlers';

import { useRuleAbilities } from './useRuleAbilities';

jest.mock('../../hooks/useAbilities', () => ({
  ...jest.requireActual('../../hooks/useAbilities'),
  useAlertingAbility: jest.fn(),
}));
jest.mock('../../hooks/abilities/rules/ruleAbilities.utils', () => ({
  ...jest.requireActual('../../hooks/abilities/rules/ruleAbilities.utils'),
  useGrafanaRulesSilenceSupport: jest.fn(),
  useCanSilenceInFolder: jest.fn(),
}));

const mockUseAlertingAbility = jest.mocked(useAlertingAbility);
const mockUseSilenceSupport = jest.mocked(useGrafanaRulesSilenceSupport);
const mockUseCanSilenceInFolder = jest.mocked(useCanSilenceInFolder);

function rule(annotationOverrides: Record<string, string> = {}): AlertRule {
  return {
    ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
    metadata: {
      name: 'rule-1',
      annotations: {
        [K8sAnnotations.AccessWrite]: 'true',
        [K8sAnnotations.AccessDelete]: 'true',
        ...annotationOverrides,
      },
    },
  };
}

function getAbilities(alertRule: AlertRule) {
  return renderHook(() => useRuleAbilities(alertRule)).result.current;
}

describe('useRuleAbilities', () => {
  beforeEach(() => {
    mockUseAlertingAbility.mockReturnValue([true, true]);
    mockUseSilenceSupport.mockReturnValue({ silenceSupported: true, silenceLoading: false });
    mockUseCanSilenceInFolder.mockReturnValue(true);
  });

  describe('provisioned rules', () => {
    it('locks edit, pause and delete with Provisioned', () => {
      const provisioned = rule({ [K8sAnnotations.Provenance]: 'terraform' });
      const abilities = getAbilities(provisioned);

      expect(abilities.edit).toEqual(Provisioned);
      expect(abilities.pause).toEqual(Provisioned);
      expect(abilities.delete).toEqual(Provisioned);
    });

    it('still allows duplicate for provisioned rules', () => {
      const provisioned = rule({ [K8sAnnotations.Provenance]: 'terraform' });
      const abilities = getAbilities(provisioned);

      expect(abilities.duplicate).toEqual(Granted);
    });
  });

  describe('plugin-managed rules', () => {
    it('locks edit, pause, delete and duplicate with IsPluginManaged', () => {
      const pluginRule = {
        ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
        metadata: {
          name: 'rule-1',
          annotations: { [K8sAnnotations.AccessWrite]: 'true', [K8sAnnotations.AccessDelete]: 'true' },
        },
        spec: {
          ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }).spec,
          labels: { __grafana_origin: 'plugin/my-plugin' },
        },
      };
      const abilities = getAbilities(pluginRule);

      expect(abilities.edit).toEqual(IsPluginManaged);
      expect(abilities.pause).toEqual(IsPluginManaged);
      expect(abilities.delete).toEqual(IsPluginManaged);
      expect(abilities.duplicate).toEqual(IsPluginManaged);
    });
  });

  describe('externally managed rules', () => {
    it('locks edit, pause and delete with Provisioned when grafana.app/managedBy is set', () => {
      const managed = rule({ 'grafana.app/managedBy': 'terraform' });
      const abilities = getAbilities(managed);

      expect(abilities.edit).toEqual(Provisioned);
      expect(abilities.pause).toEqual(Provisioned);
      expect(abilities.delete).toEqual(Provisioned);
    });

    it('still allows duplicate for managed rules', () => {
      const managed = rule({ 'grafana.app/managedBy': 'terraform' });
      const abilities = getAbilities(managed);

      expect(abilities.duplicate).toEqual(Granted);
    });
  });

  describe('missing access annotations', () => {
    it('gives INSUFFICIENT_PERMISSIONS for edit when canWrite annotation is absent', () => {
      const noWrite = {
        ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
        metadata: { name: 'rule-1', annotations: { [K8sAnnotations.AccessDelete]: 'true' } },
      };
      const abilities = getAbilities(noWrite);

      expect(abilities.edit).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
      expect(abilities.pause).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]));
    });

    it('gives INSUFFICIENT_PERMISSIONS for delete when canDelete annotation is absent', () => {
      const noDelete = {
        ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
        metadata: { name: 'rule-1', annotations: { [K8sAnnotations.AccessWrite]: 'true' } },
      };
      const abilities = getAbilities(noDelete);

      expect(abilities.delete).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleDelete]));
    });
  });

  describe('duplicate', () => {
    it('gives INSUFFICIENT_PERMISSIONS when user lacks create permission', () => {
      mockUseAlertingAbility.mockReturnValue([true, false]);
      const abilities = getAbilities(rule());

      expect(abilities.duplicate).toEqual(InsufficientPermissions([AccessControlAction.AlertingRuleCreate]));
    });

    it('grants duplicate when user has create permission', () => {
      const abilities = getAbilities(rule());

      expect(abilities.duplicate).toEqual(Granted);
    });
  });

  describe('silence', () => {
    it('grants silence when AM supports it and user can silence in folder', () => {
      const abilities = getAbilities(rule());

      expect(abilities.silence).toEqual(Granted);
    });

    it('returns Loading while AM config is loading', () => {
      mockUseSilenceSupport.mockReturnValue({ silenceSupported: false, silenceLoading: true });
      const abilities = getAbilities(rule());

      expect(abilities.silence).toEqual(Loading);
    });

    it('passes the folder annotation UID to useCanSilenceInFolder', () => {
      const ruleWithFolder = {
        ...mockK8sAlertRule({ uid: 'rule-1', title: 'CPU high' }),
        metadata: {
          name: 'rule-1',
          annotations: {
            [K8sAnnotations.AccessWrite]: 'true',
            [K8sAnnotations.AccessDelete]: 'true',
            'grafana.app/folder': 'my-folder-uid',
          },
        },
      };
      getAbilities(ruleWithFolder);

      expect(mockUseCanSilenceInFolder).toHaveBeenCalledWith('my-folder-uid');
    });

    it('denies silence when user cannot silence in folder', () => {
      mockUseCanSilenceInFolder.mockReturnValue(false);
      const abilities = getAbilities(rule());

      expect(abilities.silence.granted).toBe(false);
    });
  });
});
